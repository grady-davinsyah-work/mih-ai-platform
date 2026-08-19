# Spec Desain — MVP Platform AI Internal Kedeputian Perencanaan Makro Pembangunan

- Tanggal: 2026-08-19
- Status: **Draft — menunggu review pengguna**
- Tech stack: Bun + Express (backend) · React Vite + Tailwind (frontend) · PostgreSQL + pgvector (DB) · Python (ingestion worker) · Docker Compose (deployment)

---

## 1. Konteks & tujuan

Platform AI internal untuk **satu kedeputian** (bukan seluruh kementerian, bukan publik).
Staf internal bertanya-jawab (RAG) atas **dokumen publik** kedeputian (paparan `.pptx`,
laporan `.pdf`/`.docx`), diakses lewat **API dengan token akses**.

Semua dokumen bersifat publik → aman memakai API embedding/LLM pihak ketiga.
Target pengguna: staf internal satu kedeputian saja. Ini MVP — mulai kecil,
jangan over-engineer.

### Tujuan sukses (jalur inti)

Dokumen masuk → bisa ditanya lewat API dengan token → jawaban dengan rujukan
sumber (nama file + halaman/slide) yang jelas.

---

## 2. Batasan (in-scope / out-of-scope)

**In scope (MVP):**
- Ingestion manual: folder scan (`data/raw`) + upload per-file via dashboard.
- Parser: PPTX (teks per slide + speaker notes), PDF (teks per halaman), DOCX (per heading).
- RAG tanya-jawab dengan sitasi sumber.
- Autentikasi token API (hash, scope, masa berlaku, revoke, rate limit harian).
- Admin: user, token, usage log, status dokumen.
- Portal: login sederhana, dashboard admin, playground, halaman dokumen.

**Out of scope (MVP):**
- OCR untuk PDF hasil scan → cukup ditandai "perlu OCR" / gagal penanganan manual.
- Integrasi otomatis Drive/SharePoint.
- Data tabular/statistik yang di-query terpisah (boleh di-skip dulu; cukup dokumen naratif).
- Lintas unit kerja / multi-tenancy.
- Webhook, notifikasi, SSO.

---

## 3. Arsitektur & komponen

Empat komponen: ingestion worker, backend API, database, frontend. Dijalankan
bersama lewat `docker compose up` (satu perintah).

**Keputusan kunci:** Worker Python **menulis langsung ke PostgreSQL** yang sama
dengan backend (bukan lewat API internal). Trade-off: logika transisi status
dokumen ada di dua tempat — diterima untuk MVP karena lebih sederhana.

```
┌────────────┐   upload / status   ┌────────────┐
│  frontend  │◄──────────────────►│  backend   │
│ (Vite+Tail)│   /api/* (proxy)   │ Bun+Express│
└────────────┘                     └─────┬──────┘
                                        │ query /ask (token)
                                        ▼
                              ┌───────────────────────┐
                              │   PostgreSQL+pgvector  │
                              └───────────▲───────────┘
                                          │ insert docs/chunks
                              ┌───────────┴───────────┐
                              │   worker (Python)     │
                              │  scan raw + poll queue│
                              └───────────────────────┘
```

---

## 4. Struktur folder

```
MVP MIH/
├── docker-compose.yml
├── .env.example                  # semua konfigurasi via env
├── .gitignore
├── README.md
├── docs/superpowers/specs/       # dokumen desain ini
├── db/
│   └── init.sql                  # schema lengkap (idempotent)
├── backend/                      # Bun + Express
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.ts              # entry server
│       ├── config.ts             # baca env
│       ├── db.ts                 # pg pool
│       ├── middleware/
│       │   ├── tokenAuth.ts      # auth API token
│       │   └── sessionAuth.ts    # auth portal (cookie)
│       ├── routes/
│       │   ├── auth.ts           # login/logout portal
│       │   ├── ask.ts            # POST /api/ask
│       │   ├── admin.ts          # users, tokens, usage, documents
│       ├── services/
│       │   ├── llm.ts            # interface tipis LLM (OpenAI default)
│       │   ├── rag.ts            # similarity search + jawaban + sitasi
│       │   └── upload.ts         # simpan file + dedup sha256
│       └── lib/
│           ├── token.ts          # generate + hash sha256 token
│           └── rateLimit.ts
├── worker/                       # Python ingestion
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── ingest.py                 # CLI: `watch` (poll loop) & `scan --dir`
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── pptx.py
│   │   ├── pdf.py
│   │   └── docx.py
│   ├── chunking.py               # chunk struktural + overlap
│   ├── embedding.py              # OpenAI embeddings
│   └── db.py                     # akses PostgreSQL
├── frontend/                     # React Vite + Tailwind
│   ├── package.json
│   ├── Dockerfile                # build → nginx (proxy /api → backend)
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts                # client API
│       └── pages/
│           ├── Login.tsx
│           ├── Admin.tsx         # user & token
│           ├── Documents.tsx     # upload + status
│           └── Playground.tsx    # tanya-jawab
└── data/                         # volume (tidak ikut git)
    ├── raw/                      # folder scan, dibaca worker
    └── uploaded/                 # upload dashboard, backend+worker
```

---

## 5. Skema database

Extension: `CREATE EXTENSION IF NOT EXISTS vector;`
Embedding dimension: `1536` (text-embedding-3-small).

### `documents`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `filename` | `TEXT NOT NULL` | nama asli berkas |
| `file_type` | `TEXT NOT NULL` | `paparan` \| `laporan` \| `lainnya` |
| `file_extension` | `TEXT NOT NULL` | `pptx` \| `pdf` \| `docx` |
| `sha256` | `TEXT NOT NULL UNIQUE` | hash isi file, untuk dedup |
| `file_path` | `TEXT NOT NULL` | path di volume bersama |
| `status` | `TEXT NOT NULL DEFAULT 'pending'` | `pending` \| `processing` \| `completed` \| `failed` |
| `error_message` | `TEXT` | pesan error jika gagal |
| `chunk_count` | `INT NOT NULL DEFAULT 0` | jumlah chunk |
| `created_at` / `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

### `chunks`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `document_id` | `BIGINT NOT NULL REFERENCES documents ON DELETE CASCADE` | |
| `content` | `TEXT NOT NULL` | isi teks chunk |
| `embedding` | `vector(1536)` | vektor embedding |
| `page_or_slide` | `INT` | halaman/slide asal (nullable untuk DOCX) |
| `section_title` | `TEXT` | judul bab/sub-bab |
| `chunk_index` | `INT NOT NULL` | urutan chunk dalam dokumen |
| `is_outdated` | `BOOLEAN NOT NULL DEFAULT FALSE` | versi lama yang direvisi |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

Index: `hnsw (embedding vector_cosine_ops)`, `(document_id)`, `(is_outdated)`.

### `users`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `name` | `TEXT NOT NULL` | |
| `email` | `TEXT NOT NULL UNIQUE` | login portal |
| `unit_kerja` | `TEXT NOT NULL` | |
| `password_hash` | `TEXT NOT NULL` | scrypt/bcrypt, untuk login portal |
| `is_admin` | `BOOLEAN NOT NULL DEFAULT FALSE` | hak akses halaman admin |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

### `api_tokens`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `user_id` | `BIGINT NOT NULL REFERENCES users ON DELETE CASCADE` | |
| `name` | `TEXT NOT NULL` | label token |
| `token_hash` | `TEXT NOT NULL UNIQUE` | **sha256 token, bukan plaintext** |
| `scope` | `TEXT NOT NULL DEFAULT 'internal-read'` | `internal-read` \| `internal-admin`; mudah ditambah tier (mis. `external-readonly`) |
| `daily_limit` | `INT NOT NULL DEFAULT 100` | batas request per hari kalender |
| `expires_at` | `TIMESTAMPTZ` | null = tidak kedaluwarsa |
| `revoked_at` | `TIMESTAMPTZ` | null = aktif |
| `last_used_at` | `TIMESTAMPTZ` | |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

### `usage_logs`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `token_id` | `BIGINT NOT NULL REFERENCES api_tokens ON DELETE CASCADE` | |
| `user_id` | `BIGINT NOT NULL REFERENCES users` | |
| `question` | `TEXT NOT NULL` | |
| `answer` | `TEXT NOT NULL` | |
| `cited_chunks` | `JSONB NOT NULL DEFAULT '[]'` | `[{document_id, filename, page_or_slide, section_title}]` |
| `model` | `TEXT` | model yang dipakai |
| `latency_ms` | `INT` | |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

Index: `(token_id, created_at)`.

**Rate limit harian** dihitung via `COUNT(*)` pada `usage_logs` untuk token tsb
dengan `created_at >= awal hari` — tidak ada tabel counter terpisah, dan sekaligus
berfungsi sebagai audit.

---

## 6. Pipeline ingestion

### 6.1 Trigger

1. **Folder scan:** worker `watch` memindai `data/raw` → untuk tiap file baru:
   hitung `sha256` → lewati jika hash sudah ada di `documents` (dedup) →
   insert `documents(status='pending')`.
2. **Upload dashboard:** `POST /api/admin/documents` (multipart) → backend hitung
   `sha256` → cek dedup (409 jika duplikat) → simpan file ke `data/uploaded` →
   insert `documents(status='pending')` dengan `file_path` volume.

Worker memproses antrian: **polling** dokumen `status='pending'` setiap
`INGEST_INTERVAL_SEC` (default 30 detik).

### 6.2 Urutan pemrosesan satu dokumen

1. Set `status='processing'`.
2. Parse sesuai `file_extension` → segmen teks seragam:
   `{ text, page_or_slide, section_title }`.
3. **Chunking struktural** (detail di 6.4).
4. Embedding tiap chunk via OpenAI → `vector(1536)`.
5. Insert `chunks`.
6. Set `status='completed'`, `chunk_count`.
7. **Revisi dokumen:** jika ada dokumen lain dengan `filename` sama yang
   berstatus completed dan hash berbeda → set `is_outdated=true` pada semua
   chunk dokumen lama tersebut.
8. Error pada langkah mana pun → `status='failed'` + `error_message` (dokumen
   tetap tersimpan; bisa di-retry).

### 6.3 Parser per jenis

- **PPTX:** teks per slide (kotak teks + tabel), termasuk **speaker notes**.
  `page_or_slide` = nomor slide; `section_title` = judul slide (baris pertama
  teks non-kosong bila masuk akal).
- **PDF:** teks per halaman. `page_or_slide` = nomor halaman. Halaman tanpa teks
  → ditandai sebagai **kemungkinan hasil scan** → catat ke `error_message`/flag
  "perlu OCR" (tidak diimplementasikan di MVP).
- **DOCX:** teks dikelompokkan per heading/sub-heading. `section_title` = heading
  terdekat; `page_or_slide` = null.

### 6.4 Chunking

- Berbasis **struktur** (slide/halaman/heading), bukan potong karakter bebas.
- Target **300–800 token** per chunk, **overlap ~15%** antar chunk.
- Segmen pendek digabung sampai melewati target minimum; segmen panjang dipecah
  pada batas kalimat (bukan di tengah kalimat).
- **Metadata sumber wajib** pada tiap chunk: nama dokumen, jenis, halaman/slide,
  judul section, `chunk_index`.

---

## 7. Backend API

### 7.1 Autentikasi

**Token API** (untuk `POST /api/ask`):
- Header `Authorization: Bearer mih_<random-32+bytes>`.
- Middleware: hash token (sha256) → lookup `api_tokens` → validasi `revoked_at`
  null, `expires_at` (jika ada) belum lewat, `daily_limit` belum terlampaui.
- Update `last_used_at`.
- Gagal → `401` / `403` (revoked / scope) / `429` (rate limit).

**Sesi portal** (dashboard admin + playground):
- Login email + password (hash scrypt/bcrypt).
- Cookie sesi stateless bertanda tangan HMAC (`SESSION_SECRET`), menyimpan
  `user_id`. Tanpa tabel session (trade-off: sulit logout perangkat lain —
  diterima untuk MVP).
- Halaman admin hanya untuk `is_admin=true`.

### 7.2 Endpoint

**Token API:**
| Method | Path | Keterangan |
|---|---|---|
| `POST` | `/api/ask` | Tanya-jawab RAG; body `{ "question": string }` |

**Portal admin (cookie sesi):**
| Method | Path | Keterangan |
|---|---|---|
| `POST` | `/api/auth/login` | body `{ email, password }` → set cookie |
| `POST` | `/api/auth/logout` | hapus cookie |
| `GET` | `/api/auth/me` | user sesi saat ini |
| `GET` | `/api/admin/users` | daftar user |
| `POST` | `/api/admin/users` | buat user `{ name, email, unit_kerja, password, is_admin }` |
| `POST` | `/api/admin/users/:id/tokens` | generate token → **plaintext ditampilkan sekali** |
| `GET` | `/api/admin/tokens` | daftar token (tanpa plaintext) |
| `POST` | `/api/admin/tokens/:id/revoke` | revoke token |
| `GET` | `/api/admin/usage-logs` | log pemakaian (paginasi) |
| `GET` | `/api/admin/documents` | daftar dokumen + status |
| `POST` | `/api/admin/documents` | upload file |

### 7.3 `POST /api/ask`

1. Auth token → simpan `token_id`, `user_id`.
2. Embed pertanyaan.
3. Similarity search: `ORDER BY embedding <=> $q LIMIT k` pada
   `chunks WHERE is_outdated = false` (default `k=8`, env `VECTOR_K`).
4. Bangun konteks dari chunk relevan (teks + metadata sumber).
5. Panggil LLM (GPT-4o-mini) dengan prompt sistem:
   - Jawab dalam **Bahasa Indonesia**.
   - Hanya gunakan konteks; jika tidak cukup → katakan tidak tahu.
   - **Wajib** merujuk sumber (nama file + halaman/slide + section).
6. Response:
   ```json
   {
     "answer": "…",
     "citations": [
       { "document_id": 1, "filename": "paparan.pptx", "file_type": "paparan",
         "page_or_slide": 4, "section_title": "…" }
     ]
   }
   ```
7. Insert `usage_logs` (question, answer, cited_chunks, model, latency_ms).

---

## 8. Frontend dashboard

React Vite + Tailwind, satu origin dengan backend via nginx proxy `/api` (tanpa
CORS). Halaman:

- **Login** — email + password.
- **Playground** — form tanya-jawab; tampilkan jawaban + sitasi (nama file,
  halaman/slide). Dipakai untuk uji coba manual.
- **Admin** (hanya `is_admin`) — kelola user (buat/hapus), kelola token
  (generate → tampilkan plaintext sekali, revoke), lihat usage log (paginasi).
- **Documents** — daftar dokumen + status ingestion (pending/processing/
  completed/failed + error message), upload file baru.

---

## 9. Docker Compose

Service (satu `docker compose up`):

| Service | Image | Catatan |
|---|---|---|
| `db` | `pgvector/pgvector:pg16` | volume `db_data`; `init.sql` via `/docker-entrypoint-initdb.d` |
| `worker` | `python:3.12-slim` | jalankan `python ingest.py watch`; mount `data/` |
| `backend` | `oven/bun` | Express, port 3000 (internal) |
| `frontend` | build `node:22` → serve `nginx` | port 8080 publik; proxy `/api` → `backend:3000` |

Volume: `db_data` (persisten) + bind mount `./data` (raw & uploaded, dibagikan
backend & worker). `depends_on` db sehat sebelum service lain.

### Env (` .env.example`)

```
DATABASE_URL=postgres://mih:mih@db:5432/mih
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
SESSION_SECRET=<generate-random>
PORT=3000
DATA_DIR=/data
INGEST_INTERVAL_SEC=30
VECTOR_K=8
ADMIN_EMAIL=admin@kedeputian.go.id
ADMIN_PASSWORD=<initial>
```

Seed admin CLI: jalankan sekali (mis. `bun run seed` di backend, atau script
SQL) untuk membuat user admin awal.

---

## 10. Pengujian

- **Worker:** unit test parser (fixture PPTX/PDF/DOCX kecil) + chunking
  (panjang dalam rentang, overlap, metadata sumber hadir).
- **Backend:** unit test hash token, rate limit, auth middleware; integrasi
  `/ask` dengan LLM di-mock (verifikasi sitasi & log).
- **Smoke E2E:** `docker compose up` → seed admin → upload contoh paparan →
  tanya → jawaban + sitasi.

---

## 11. Milestone implementasi

Urutan (sesuai kesepakatan):

1. **DB schema + migration** — `db/init.sql` idempotent.
2. **Ingestion worker (Python)** — parser ×3, chunking, embedding, dedup, status, CLI.
3. **Backend API (Bun + Express)** — token auth + rate limit, `/api/ask` + sitasi, endpoint admin, login portal.
4. **Frontend dashboard** — Login, Admin, Documents, Playground.
5. **Docker Compose** — semua service, seed admin, smoke test.
