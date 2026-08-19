# MVP MIH — Platform AI Internal Kedeputian Perencanaan Makro Pembangunan

RAG tanya-jawab atas dokumen publik kedeputian (PPTX/PDF/DOCX), diakses lewat API
dengan token, dengan portal admin + playground.

## Menjalankan

1. Salin `.env.example` → `.env`, isi `OPENAI_API_KEY`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
2. `docker compose up -d --build`
3. Buat admin: `docker compose exec backend bun run seed`
4. Buka portal: http://localhost:8080
5. (Opsional) buat sampel: `docker compose exec -T worker python scripts/make_samples.py /data/raw`

## Alur pakai

- Upload/letakkan dokumen di `data/raw` (atau upload lewat halaman Dokumen).
- Worker mengingest otomatis (status di halaman Dokumen).
- Buat token di halaman Admin → pakai token untuk `POST /api/ask`.

```bash
curl -X POST http://localhost:8080/api/ask \
  -H "Authorization: Bearer mih_..." \
  -H "Content-Type: application/json" \
  -d '{"question":"Apa prioritas rencana pembangunan makro?"}'
```

## Pengembangan lokal

- DB: `bash scripts/dev-db.sh` (pgvector di port 5432 + db `mih_test`).
- Backend: `cd backend && bun install && bun run dev` (`bun test` untuk tes).
- Worker: `cd worker && pip install -r requirements.txt && python ingest.py watch`.
- Frontend: `cd frontend && npm install && npm run dev` (proxy `/api` → :3000).
