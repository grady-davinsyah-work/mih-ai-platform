# n8n sebagai RAG Retrieval Engine MIH — Design

**Tanggal:** 2026-08-27
**Status:** Draft — menunggu review user sebelum rencana implementasi
**Terkait:** [[mih-chat-drive-deploy]] (arsitektur dua mesin), [[content-system-deploy]]

## Konteks & Masalah

MIH sudah punya RAG pipeline lengkap:
- `worker/ingest.py`: parse → chunk → embed (OpenAI `text-embedding-3-small`, 1536 dim) → insert ke tabel `chunks` (pgvector).
- `backend/src/services/rag.ts`: `search()` = embed pertanyaan + query `embedding <=> $1::vector` → `generateAnswer`/`streamAnswer` → SSE streaming ke Playground.

User punya n8n yang sudah ter-embed di infrastruktur mereka dan ingin n8n menjadi RAG engine. **Vektor dokumen SUDAH ada** di `chunks` — n8n tidak perlu embed ulang dokumen.

Kendala teknis: webhook n8n (node *Respond to Webhook*) tidak mendukung SSE streaming per-token. Agar streaming Playground tetap utuh, n8n mengambil alih bagian **retrieval** (`search()`), sedangkan **generasi + streaming tetap di MIH**.

## Keputusan Arsitektur

- **n8n = retrieval engine.** Menggantikan `search()`: embed pertanyaan → query pgvector → bangun `context` (format identik) → balas ke MIH.
- **MIH = generasi + streaming.** `generateAnswer`, `streamAnswer`, dan ekstraksi citations tidak berubah.
- **Worker tetap menulis vektor.** n8n hanya baca `chunks`. Drive sync + ingest pipeline tidak berubah.
- **Satu round-trip webhook per pertanyaan** sebelum token pertama (dampak kecil karena n8n di jaringan Tailscale yang sama).

## Webhook Contract

n8n membuka webhook: `POST {N8N_RAG_WEBHOOK_URL}`

**Request** (MIH → n8n):
```json
{ "question": "berapa persen PPN atas jasa ...", "vector_k": 8 }
```

**Response sukses** (n8n → MIH):
```json
{
  "labeled": [
    { "document_id": 12, "filename": "PMK-111.pdf", "file_type": "laporan",
      "page_or_slide": 3, "section_title": "Kenaikan Tarif",
      "content": "Teks chunk ...", "label": 1 }
  ],
  "context": "[1] (File: PMK-111.pdf, laporan, halaman/slide 3, Bagian: Kenaikan Tarif)\nTeks chunk ..."
}
```

**Response error:** HTTP 4xx/5xx dengan body `{ "error": "..." }`.

**Aturan parity:** field `labeled` harus cocok dengan tipe `SearchRow` MIH (`document_id`, `filename`, `file_type`, `page_or_slide`, `section_title`, `label`) plus `content`. Format `context` harus identik dengan `search()` di `rag.ts` (lihat lampiran) agar prompt, jawaban, dan citations Playground tidak berubah.

## n8n Workflow — "RAG Retrieval"

1. **Webhook trigger** — node *Webhook* mode *Receive* (POST), parse JSON body.
2. **OpenAI Embeddings node** — model `text-embedding-3-small` (**WAJIB sama** dengan `config.embeddingModel`; dimensi 1536), input = `question`.
3. **Postgres node** (pgvector):
   ```sql
   SELECT c.id, c.content, c.page_or_slide, c.section_title,
          d.id AS document_id, d.filename, d.file_type
     FROM chunks c JOIN documents d ON d.id = c.document_id
    WHERE c.is_outdated = FALSE AND d.status = 'completed'
    ORDER BY c.embedding <=> $1::vector
    LIMIT $2
   ```
   Parameter: `$1` = embedding pertanyaan (array float), `$2` = `vector_k`.
4. **Code node** — tambah `label = index + 1` per baris; bangun `context`:
   `[N] (File: {filename}, {file_type}[, halaman/slide {page_or_slide}][, Bagian: {section_title}])\n{content}`
   baris digabung dengan `\n\n---\n\n`.
5. **Respond to Webhook** — JSON `{ labeled, context }`.
6. **Error handling** — percabangan error → Respond to Webhook status 500, body `{ "error": "..." }`.

**Kredensial:** Postgres MIH (disarankan user read-only: `SELECT` pada `chunks`/`documents`), OpenAI key yang sama dengan MIH. n8n harus bisa reach Postgres MIH (Tailscale / jaringan yang sama).

## Perubahan di MIH

**`backend/src/config.ts`** — tambah satu field:
```ts
ragWebhookUrl: process.env.N8N_RAG_WEBHOOK_URL ?? "",
```

**`backend/src/services/rag.ts`** — logika `search()`:
- Jika `config.ragWebhookUrl` terisi: POST ke webhook `{ question, vector_k: config.vectorK }`, timeout ~30 detik, parse `{ labeled, context }`.
- Jika panggilan gagal (error jaringan, status != 2xx, atau format response salah): **fallback ke query SQL lokal yang ada sekarang** (degradasi — RAG tetap jalan saat n8n down), log peringatan.
- Jika `ragWebhookUrl` kosong: pakai SQL lokal langsung (perilaku saat ini).

**`.env.example` dan `.env.example.prod`** — tambah baris `N8N_RAG_WEBHOOK_URL=`.

**Tidak berubah:** frontend, endpoint `/api/chat`, worker, schema DB, Drive sync.

## Rulings

- **R1 — n8n = retrieval, LLM di MIH.** Webhook n8n tidak streaming, jadi streaming asli hanya mungkin bila generasi tetap di MIH. n8n sebagai engine penuh (ikut generate) berarti kehilangan streaming per-token → ditolak user.
- **R2 — Fallback ke SQL lokal.** Kalau n8n down, `/api/ask` tidak boleh mati total; jatuh ke query pgvector langsung (perilaku lama). Biaya: SQL lama tetap dipelihara (duplikasi kecil, satu fungsi).
- **R3 — Worker tidak berubah.** Vektor sudah ada dan terus diisi worker; n8n baca saja. Tidak ada re-embed dokumen.
- **R4 — Mode mock tidak butuh guard.** Webhook mode tidak embed lokal, jadi `LLM_PROVIDER=mock` tidak bertabrakan dengan webhook. Untuk dev lokal cukup kosongkan `N8N_RAG_WEBHOOK_URL`. Guard `provider !== "mock"` sengaja TIDAK dipakai supaya jalur fallback bisa diuji di bawah provider mock.

## File yang Terlibat

| Aksi | File |
|------|------|
| edit | `backend/src/config.ts` — tambah `ragWebhookUrl` |
| edit | `backend/src/services/rag.ts` — `search()` webhook + fallback |
| edit | `.env.example`, `.env.example.prod` — `N8N_RAG_WEBHOOK_URL=` |
| baru (opsional) | `n8n/rag-retrieval.json` — export workflow n8n untuk versioning |
| eksternal | workflow n8n di instance n8n milik user (dibuat manual di UI) |

## Verifikasi

1. Curl webhook: `curl -X POST {url} -H 'Content-Type: application/json' -d '{"question":"..."}'` → `{ labeled, context }` valid, top-k sesuai `vector_k`.
2. Playground: tanya → jawaban streaming per-token, citations muncul, format sama seperti sebelum n8n.
3. Fallback: stop workflow n8n → `/api/ask` tetap menjawab via SQL lokal, ada log warning.
4. Tidak ada field citation yang hilang/berbeda (`document_id, filename, file_type, page_or_slide, section_title`).
5. Perilaku lama tidak berubah bila `N8N_RAG_WEBHOOK_URL` kosong.

## Batasan & Asumsi

- Model embedding n8n **WAJIB sama** (`text-embedding-3-small`) — kalau beda, retrieval salah diam-diam. n8n memakai OpenAI key yang sama.
- n8n butuh kredensial Postgres MIH (read-only disarankan).
- Workflow n8n dibuat & di-deploy di sisi user; MIH hanya butuh URL webhook.
- Latency tambahan: satu round-trip HTTP sebelum token pertama.

---

## Lampiran: `search()` yang ada (referensi parity)

```sql
SELECT c.id, c.content, c.page_or_slide, c.section_title,
       d.id AS document_id, d.filename, d.file_type
  FROM chunks c JOIN documents d ON d.id = c.document_id
 WHERE c.is_outdated = FALSE AND d.status = 'completed'
 ORDER BY c.embedding <=> $1::vector
 LIMIT $2
```

Format context (per baris):
```
[N] (File: {filename}, {file_type}, halaman/slide {page_or_slide}, Bagian: {section_title})
{content}
```
(komponen `halaman/slide` dan `Bagian` di-skip bila null), baris digabung `\n\n---\n\n`.
