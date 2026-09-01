# n8n sebagai RAG Retrieval Engine MIH

Dokumen operasional: cara membangun workflow n8n yang mengambil alih bagian **retrieval** pada MIH.

## 1. Ringkasan peran n8n

n8n bertindak sebagai **retrieval engine**: menerima pertanyaan via webhook, membuat embedding, query pgvector, membangun `context` — lalu mengembalikan `{ labeled, context }` ke MIH. **Generasi jawaban dan streaming SSE tetap di MIH** (`backend/src/services/rag.ts`), karena node *Respond to Webhook* n8n tidak mendukung streaming per-token.

```
MIH  --POST {question, vector_k}-->  n8n webhook
n8n  embed question -> query pgvector -> bangun context
n8n  --{labeled, context}-->  MIH  (generateAnswer / streamAnswer + citations)
```

Vektor dokumen **sudah ada** di tabel `chunks` (diisi worker) — n8n tidak perlu embed ulang dokumen, hanya baca.

## 2. Prasyarat

- **Postgres MIH** dapat diakses dari mesin n8n (jaringan Tailscale yang sama): database `mih`, skema `public`, tabel `chunks` dan `documents`.
- **OpenAI API key yang sama** dengan MIH (untuk node Embeddings dan model yang sama).

## 3. (Opsional, disarankan) User Postgres read-only

Agar workflow n8n hanya bisa `SELECT` dan tidak bisa mengubah data, buat user read-only:

```sql
CREATE USER mih_rag_ro WITH PASSWORD '<ganti>';
GRANT CONNECT ON DATABASE mih TO mih_rag_ro;
GRANT USAGE ON SCHEMA public TO mih_rag_ro;
GRANT SELECT ON chunks, documents TO mih_rag_ro;
```

Ganti `<ganti>` dengan password yang kuat. Simpan kredensial ini untuk node Postgres di n8n.

## 4. Langkah build workflow "RAG Retrieval"

Ada dua cara: **A — impor file** (disarankan), atau **B — bangun manual** (fallback, bila impor bermasalah).

### Cara A — Impor file `n8n/rag-retrieval.json` (disarankan)

Workflow siap pakai sudah disediakan di repo: `n8n/rag-retrieval.json`.

1. Buka n8n → **Workflows** → tombol *Import from File* → pilih `n8n/rag-retrieval.json`.
2. Buka workflow hasil impor ("MIH RAG Retrieval").
3. **Pilih kredensial** di dua node yang ditandai *missing credential*:
   - **Embed Pertanyaan** → pilih kredensial **OpenAI API** (harus pakai key yang sama dengan MIH).
   - **Cari Chunk** → pilih kredensial **Postgres** (user read-only `mih_rag_ro` dari Bagian 3, atau user MIH biasa).
4. **Aktifkan** workflow (toggle *Active*).
5. Salin **URL produksi** webhook (tampil di node Webhook) → pakai sebagai `{WEBHOOK_URL}` di tes curl (Bagian 5).

Rantai node: **Webhook (POST)** → **Embed Pertanyaan** (HTTP Request ke OpenAI `/v1/embeddings`) → **Siapkan SQL** (Code) → **Cari Chunk** (Postgres) → **Bangun Context** (Code) → **Balas ke MIH** (Respond to Webhook).

Catatan: bila workflow error di tengah, n8n membalas 500 → MIH otomatis fallback ke query lokal (degradasi). Tidak ada node error khusus yang perlu ditambah.

### Cara B — Bangun manual (bila impor bermasalah)

Node per node: **Webhook (POST)** → **HTTP Request (embedding)** → **Postgres** → **Code** → **Respond to Webhook**.

**Node 1 — Webhook**

Node *Webhook*, mode *Receive*, method **POST**, *Respond* = *Using "Respond to Webhook" Node*. Catat URL webhook untuk tes curl (pakai sebagai `{WEBHOOK_URL}`).

**Node 2 — HTTP Request (embedding pertanyaan)**

Node *HTTP Request*: method **POST**, URL `https://api.openai.com/v1/embeddings`, *Authentication* = *Generic Credential Type* → **OpenAI API** (key yang sama dengan MIH). *Body* = *JSON*, isi:
```json
{ "model": "text-embedding-3-small", "input": "{{ $json.body.question }}" }
```
Model **WAJIB** `text-embedding-3-small` (sama dengan `EMBEDDING_MODEL` MIH).

> Catatan: jangan pakai node *OpenAI Embeddings* (kategori AI) di workflow ini — node itu sub-node (input kosong, hanya tersambung ke AI Agent), tidak bisa dirantai dari Webhook biasa. Embedding via HTTP Request menghasilkan vektor yang sama.

**Node 3 — Code "Siapkan SQL"**

Ambil `embedding` dari respons HTTP (`$json.data[0].embedding`) dan `vector_k` dari body webhook; bangun query lengkap:

```js
const body = $('Webhook').first().json.body || {};
const emb = $json.data[0].embedding;
if (!Array.isArray(emb) || emb.length === 0) throw new Error('embedding tidak valid');
const vectorK = Number(body.vector_k) || 8;
const query = `SELECT c.id, c.content, c.page_or_slide, c.section_title,
       d.id AS document_id, d.filename, d.file_type
  FROM chunks c JOIN documents d ON d.id = c.document_id
 WHERE c.is_outdated = FALSE AND d.status = 'completed'
 ORDER BY c.embedding <=> '[${emb.join(',')}]'::vector
 LIMIT ${vectorK}`;
return [{ json: { query }, pairedItem: { item: 0 } }];
```

(Query SQL sama seperti lampiran spec; embedding dipakai langsung sebagai literal vektor.)

**Node 4 — Postgres (pgvector)**

Node *Postgres*, operation **Execute Query**, query = `={{ $json.query }}` (dari node Code di atas). Kredensial: user read-only `mih_rag_ro` dari Bagian 3.

**Node 5 — Code "Bangun Context"**

Per baris hasil: tambah `label = index + 1`; bangun `context` per baris dengan format:

`[N] (File: {filename}, {file_type}[, halaman/slide {page_or_slide}][, Bagian: {section_title}])\n{content}`

(komponen `halaman/slide` dan `Bagian` di-skip bila null), baris digabung `\n\n---\n\n`. Format per baris bila semua field terisi:

```
[N] (File: {filename}, {file_type}, halaman/slide {page_or_slide}, Bagian: {section_title})
{content}
```

Return: `[{ json: { labeled, context } }]`, dengan `labeled` = array hasil + field `label`.

**Node 6 — Respond to Webhook**

*Respond With* = **JSON**, *Response Body* = `={{ JSON.stringify($json) }}`, *Response Code* = `200`. Balas `{ labeled, context }`.

**Error handling** — tidak perlu node khusus: bila workflow error, n8n membalas 500, dan MIH otomatis fallback ke query lokal (degradasi).

## 5. Tes curl

```bash
curl -X POST {WEBHOOK_URL} -H 'Content-Type: application/json' \
  -d '{"question":"berapa persen PPN atas jasa?","vector_k":8}'
```

Expected: JSON `{ labeled, context }`, dengan `labeled.length` = `vector_k` (atau kurang bila dokumen tidak mencukupi).

## 6. Setelah webhook OK — aktifkan di MIH

1. Set `N8N_RAG_WEBHOOK_URL` di env server backend.
2. Deploy backend.
3. Verifikasi di Playground: tanya → jawaban streaming per-token + citations muncul, format sama seperti sebelum n8n.

Catatan perilaku:
- Bila `N8N_RAG_WEBHOOK_URL` kosong → MIH memakai query SQL lokal (perilaku lama).
- Bila panggilan webhook gagal → MIH **fallback otomatis** ke query SQL lokal (degradasi, RAG tetap jalan saat n8n down).

## 7. Catatan penting

- Model embedding n8n **WAJIB** `text-embedding-3-small`, sama dengan `EMBEDDING_MODEL` MIH (dimensi 1536). Bila diganti, retrieval salah diam-diam (vektor tidak sebanding) — tidak ada error yang muncul.
