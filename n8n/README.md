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

## 4. Langkah build workflow "RAG Retrieval" (di UI n8n)

Node per node: **Webhook (POST)** → **OpenAI Embeddings** → **Postgres** → **Code** → **Respond to Webhook** → percabangan **error** → **500**.

**Node 1 — Webhook**

Node *Webhook*, mode *Receive*, method **POST**, *Respond* = *Using "Respond to Webhook" Node*. Catat URL webhook untuk tes curl (pakai sebagai `{WEBHOOK_URL}`).

**Node 2 — OpenAI Embeddings**

Model `text-embedding-3-small`, input = `question`.

**Node 3 — Postgres (pgvector)**

Query (parameter: `$1` = embedding pertanyaan array float, `$2` = `vector_k`):

```sql
SELECT c.id, c.content, c.page_or_slide, c.section_title,
       d.id AS document_id, d.filename, d.file_type
  FROM chunks c JOIN documents d ON d.id = c.document_id
 WHERE c.is_outdated = FALSE AND d.status = 'completed'
 ORDER BY c.embedding <=> $1::vector
 LIMIT $2
```

**Node 4 — Code**

Per baris hasil: tambah `label = index + 1`; bangun `context` per baris dengan format:

`[N] (File: {filename}, {file_type}[, halaman/slide {page_or_slide}][, Bagian: {section_title}])\n{content}`

(komponen `halaman/slide` dan `Bagian` di-skip bila null), baris digabung `\n\n---\n\n`. Format per baris bila semua field terisi:

```
[N] (File: {filename}, {file_type}, halaman/slide {page_or_slide}, Bagian: {section_title})
{content}
```

**Node 5 — Respond to Webhook**

Balas JSON `{ labeled, context }`, dengan `labeled` = array hasil + field `label`.

**Node 6 — Error handling**

Percabangan error → **Respond to Webhook** status **500**, body `{ "error": "..." }`.

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
