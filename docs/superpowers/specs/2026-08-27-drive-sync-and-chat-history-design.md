# Desain: Sinkronisasi Google Drive + Playground Chat Berriwayat (ala Claude)

## Context

MIH punya pipeline RAG: admin upload dokumen satu-satu via halaman Documents, backend menulis file ke `/data/uploaded` (volume `appdata`), worker (`ingest.py watch`) memproses file `pending` berdasarkan `file_path` tersimpan → parse/chunk/embed → `chunks`. Worker juga men-scan `/data/raw` tiap 30 detik untuk file baru (mekanisme yang sama, dipakai untuk kanal Drive).

Dua permintaan user:
1. **Koneksi Google Drive** — ganti/alihkan cara input RAG dari upload satu-satu ke folder Google Drive yang sudah berisi file RAG (pdf/pptx/docx). Keputusan: pakai **rclone + akun Google (OAuth)**, perilaku **sinkron penuh** (file dihapus dari Drive ikut dihapus dari RAG; file diubah disinkron ulang).
2. **Playground ala Claude** — ubah halaman Tanya-Jawab jadi chat dengan riwayat percakapan. Keputusan: **streaming (SSE)**, riwayat **per-user**, tampilan **sidebar kiri ala Claude**.

## Perubahan A — Sinkronisasi Google Drive (rclone)

### Konsep

rclone meng-sinkronisasi folder Google Drive ke `/data/raw` (volume `appdata` yang dibagi backend–worker). Worker yang sudah `watch /data/raw` akan meng-ingest file baru. `mark_outdated_same_filename` sudah menangani file yang diubah (filename sama, sha256 beda → chunk lama ditandai outdated, di-embed ulang).

### 1. Install rclone di worker

`worker/Dockerfile` — base `python:3.12-slim` (Debian):

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends rclone && rm -rf /var/lib/apt/lists/*
```

### 2. Konfigurasi rclone

- `rclone.conf` dihasilkan sekali oleh user (login akun Google pemilik folder Drive). Disimpan di host sebagai file rahasia (tidak di-git), di-mount read-only ke container worker, mis. `/data/rclone/rclone.conf` (volume `appdata` — tetap ada lintas recreate) atau mount file tersendiri.
- Env worker: `RCLONE_CONFIG=/data/rclone/rclone.conf`, plus `DRIVE_REMOTE=gdrive:<path-folder>` dan `DRIVE_SYNC_INTERVAL_MIN` (default 15).
- Proxy korporat: worker sudah dapat `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` dari `x-proxy-env` di compose — rclone hormati itu, tanpa kerja tambahan.

### 3. Sync + prune (worker)

Tambah di `worker/ingest.py`:

- Fungsi `drive_sync()`: jalankan rclone via subprocess:
  ```
  rclone sync "$DRIVE_REMOTE" /data/raw \
    --include "*.pdf" --include "*.pptx" --include "*.docx" \
    --transfers 4 --log-level ERROR
  ```
  Dipanggil:
  - saat `watch()` — sync berjalan pada interval sendiri (`DRIVE_SYNC_INTERVAL_MIN`, default 15) dengan countdown di dalam loop `watch`, terpisah dari interval scan/ingest 30s,
  - via subcommand manual `ingest.py drive-sync` untuk sinkronisasi pertama / paksa.
- Fungsi `prune_removed()`: dokumen ber-`source='drive'` yang `file_path`-nya tidak lagi ada di disk → `DELETE FROM documents WHERE id=$1` (chunks ter-cascade ON DELETE). Dijalankan setelah `drive_sync()`. Dipanggil hanya bila `DRIVE_REMOTE` ter-set.
- Kolom `source` baru di tabel `documents` (`TEXT NOT NULL DEFAULT 'upload'`) untuk membedakan asal file: upload manual vs Drive. Prune hanya menyentuh `source='drive'` — file `/data/uploaded` tidak pernah kena.

### 4. Database (migrasi manual)

`db/init.sql` ditambah (dan dijalankan manual ke DB yang sudah hidup, pola sama dengan tabel `content`):

```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload';
CREATE INDEX IF NOT EXISTS documents_source_idx ON documents (source);
```

Catatan: row dokumen yang di-insert dari `scan_dir` (`/data/raw`) diberi `source='drive'`; row dari upload backend tetap `'upload'`. Update `ensure_raw_document` untuk menerima `source`.

### 5. Konfigurasi env baru

`.env.example.prod` ditambah: `DRIVE_REMOTE=`, `DRIVE_SYNC_INTERVAL_MIN=15`, `RCLONE_CONFIG=/data/rclone/rclone.conf`. `.env.prod` (dan `.env` keuanganpmp) diisi saat setup.

### 6. Setup sekali (manual, partisipasi user)

1. User jalankan `rclone config` di PC → remote `gdrive` → login akun pemilik folder → `rclone.conf`.
2. scp `rclone.conf` ke kedua server.
3. Set `DRIVE_REMOTE=gdrive:<folder>` di env.
4. `docker compose ... exec worker python ingest.py drive-sync` → verifikasi dokumen masuk tabel `documents` status `completed`.
5. Aktifkan interval (env) → loop `watch` menyinkronkan otomatis.

## Perubahan B — Playground Chat Berriwayat (ala Claude)

### Konsep

Playground jadi chat multi-turn dengan riwayat per-user. Pertanyaan → RAG → jawaban streaming (SSE) → disimpan sebagai percakapan. User bisa buat percakapan baru, lanjut percakapan lama, hapus percakapan.

### 1. Database (dua tabel, migrasi manual)

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  citations       JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);
```

### 2. Backend — route `chat.ts` (baru)

`backend/src/routes/chat.ts`, di-mount di `app.ts` (`app.use("/api", chatRoutes)`):

- `GET /api/conversations` (`requireLogin`) — daftar percakapan milik user: `id, title, updated_at, message_count`, urut `updated_at DESC`.
- `POST /api/conversations` (`requireLogin`) — buat percakapan kosong → `{ id }`.
- `DELETE /api/conversations/:id` (`requireLogin`, pemilik) — hapus (messages cascade).
- `GET /api/conversations/:id/messages` (`requireLogin`, pemilik) — `[{ id, role, content, citations, created_at }]`.
- `POST /api/chat` (`askAuth`) — **SSE streaming**:
  1. Terima `{ question, conversation_id? }`.
  2. Bila `conversation_id` tidak ada → buat percakapan baru, `title` = 50 karakter pertama pertanyaan; `updated_at=now()`.
  3. Insert pesan `role='user'`; update `conversations.updated_at`.
  4. `askStream(question)` (lihat rag.ts) → hasilkan delta teks.
  5. Kirim SSE: `event: meta` `{conversation_id}`, lalu `event: delta` `{text}` per potongan, lalu `event: citations` `{citations}`, lalu `event: done`.
  6. Insert pesan `role='assistant'` berisi teks penuh + citations JSONB.
  7. Error: `event: error` `{message}`.
  - Header response: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no` (nginx). Hilangkan buffering via `res.flushHeaders()`.
  - `usage_logs` tetap diisi (paritas dengan alur `/ask` lama).

### 3. Backend — streaming di service

`backend/src/services/llm.ts` — tambah:

```ts
export async function* streamAnswer(question: string, context: string): AsyncGenerator<string> {
  if (config.llmProvider === "mock") { yield `Jawaban (mock) berdasarkan [1]: ${question}`; return; }
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const stream = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [ { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Pertanyaan: ${question}\n\nKonteks:\n${context}` } ],
    stream: true,
  });
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
```

`backend/src/services/rag.ts` — tambah `askStream`:

```ts
export async function askStream(question: string):
  AsyncGenerator<{ delta: string } | { citations: Citation[] }> {
  // langkah embed + vector search SAMA seperti ask() — diekstrak ke helper `search(question)`
  let text = "";
  for await (const delta of streamAnswer(question, context)) {
    text += delta;
    yield { delta };
  }
  const cited = extractCitedIndices(text);
  const citations = labeled.filter(r => cited.has(r.label)).map(...); // seperti ask()
  yield { citations };
}
```

`ask()` lama direfactor untuk memakai `search()` yang sama — jangan duplikasi logika pencarian.

### 4. Frontend — Playground dirombak

`frontend/src/api.ts` tambah:

```ts
conversations: () => req<Conversation[]>("/api/conversations"),
createConversation: () => req<{ id: number }>("/api/conversations", { method: "POST", body: JSON.stringify({}) }),
deleteConversation: (id: number) => req<{ ok: boolean }>(`/api/conversations/${id}`, { method: "DELETE" }),
conversationMessages: (id: number) => req<ChatMessage[]>(`/api/conversations/${id}/messages`),
chat: async (question, conversationId?, onEvent) => { /* fetch POST /api/chat, baca ReadableStream, parse SSE */ }
```

Types: `Conversation { id, title, updated_at, message_count }`, `ChatMessage { id, role, content, citations, created_at }`.

`frontend/src/pages/Playground.tsx` — layout dua kolom:

- **Sidebar kiri** (`lg:flex`, collapsible di layar sempit via toggle):
  - Tombol "Chat baru" → reset thread, buat percakapan kosong (atau lazy saat kirim pertama).
  - Daftar percakapan: judul, tanggal, tombol hapus (konfirmasi). Klik → muat messages.
- **Area chat**:
  - Bubbles: user kanan, assistant kiri. Render streaming dengan kursor saat menunggu. Citations per pesan assistant (daftar rujukan seperti Playground sekarang, `CitationPin`).
  - Composer bawah: textarea + tombol kirim, Enter untuk kirim (Shift+Enter newline), disabled saat streaming.
  - Error banner bila gagal.
- Komponen baru opsional `frontend/src/components/ConversationSidebar.tsx` bila Playground terlalu panjang.

Komponen UI reuse: `Card`, `Button`, `Textarea`, `CitationPin`, `ErrorBanner`, `PageHeader`.

## Verifikasi

1. `bun build src/app.ts --target=bun --outdir /tmp/backend-check` — lolos.
2. `cd frontend && npm run build` — TS + Vite lolos.
3. Worker unit-test ringan: `ingest.py drive-sync` (dengan remote dummy / rclone.conf ter-set) + `prune_removed`.
4. Migrasi DB dijalankan manual di kedua server (pola tabel `content`): `ALTER TABLE documents ADD COLUMN source...`, `CREATE TABLE conversations/messages`.
5. Deploy kedua server; verifikasi:
   - File Drive masuk `/data/raw` → status `completed` di tabel `documents`.
   - Hapus file di Drive → sync → dokumen hilang dari `documents` (RAG berhenti merujuk).
   - Playground: chat baru → jawaban streaming → refresh → percakapan masih ada → lanjut percakapan → hapus percakapan.
   - Rujukan (citations) muncul per pesan assistant.
   - `/ask` lama tetap berfungsi (paritas, backward-compat).
6. Smoke browser (msedge + playwright-core) untuk Playground baru.

## Risiko & mitigasi

- **OAuth Google di jaringan Bappenas** — rclone `config` bisa gagal interaktif di server; jalankan di PC user lalu scp `rclone.conf`. Proxy sudah diset.
- **SSE vs nginx buffering** — wajib `X-Accel-Buffering: no` + `res.flushHeaders()`, kalau tidak jawaban menggumpal.
- **File besar banyak saat sync pertama** — `--transfers 4`, interval sync terpisah dari scan; ingest tetap 30s.
- **Salah hapus file upload manual** — prune hanya `source='drive'`, jadi aman.

## Di luar scope (YAGNI)

- Webhook/notifikasi real-time Drive (cukup polling).
- Auth baru (chat per-user pakai session).
- Ganti alur upload manual (tetap berfungsi sebagai kanal kedua).
- Multi-akun / pemilihan folder via UI (cukup konfigurasi env).
