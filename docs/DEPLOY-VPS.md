# Deploy MIH ke VPS (Pola Produksi)

Runbook untuk menempatkan MIH di **VPS terpisah** dengan **domain terpisah**,
mengikuti pola produksi Arthakarya: db/backend/worker tanpa host port, frontend
bind `127.0.0.1:8080`, TLS & reverse proxy ditangani **nginx di host**, sertifikat
via **certbot DNS-01 Cloudflare**.

> **Status sekarang: refactor file saja.** Belum ada perubahan di server. Jalankan
> langkah di bawah saat siap connect domain — VPS-nya sudah dimiliki (multi-aplikasi).

---

## Arsitektur

```
Internet
   │  https://mih.<domain>.go.id
   ▼
nginx HOST (VPS) :80/:443   ← TLS (certbot DNS-01 Cloudflare), security headers
   │  proxy_pass http://127.0.0.1:8080
   ▼
MIH frontend container (nginx internal, HTTP) — /api → backend:3000, SPA fallback
   │
   ▼  jaringan Docker internal (tanpa host port)
backend :3000  ─ db (pgvector) :5432  ─ worker
```

- **Tidak ada service certbot di compose MIH** — TLS di host (bedanya dari
  Arthakarya yang memakai certbot di dalam compose).
- Backend **tidak butuh CORS**: semua request datang dari satu origin via nginx
  (same-origin), persis seperti dev.
- Port `127.0.0.1:8080` hanya bisa dijangkau dari host → aplikasi VPS lain di
  port/domain lain aman berdampingan.

---

## Langkah-langkah

### 1. Prasyarat VPS
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-dns-cloudflare
sudo systemctl enable --now docker nginx
```

### 2. DNS (Cloudflare)
Buat record A di Cloudflare:
- Nama: `mih`
- Isi: `<IP_VPS>`
- Proxy status: **DNS only** (abu-abu) agar DNS-01 bisa diverifikasi; bisa diaktifkan
  proxy Orange setelah TLS berjalan.

### 3. Kredensial Cloudflare untuk certbot (DNS-01)
Buat API token Cloudflare dengan permission `Zone.DNS:Edit` untuk zone domain.
Simpan di VPS:
```bash
sudo mkdir -p /etc/letsencrypt
sudo tee /etc/letsencrypt/cloudflare.ini >/dev/null <<'EOF'
dns_cloudflare_api_token = <API_TOKEN>
EOF
sudo chmod 600 /etc/letsencrypt/cloudflare.ini
```
> Token hanya hidup di VPS — **tidak di-commit** ke repo.

### 4. Terbitkan sertifikat (DNS-01)
```bash
sudo certbot certonly \
  --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d mih.<domain>.go.id \
  --email admin@<domain>.go.id --agree-tos --no-eff-email
```

### 5. Aktifkan reverse proxy host
1. Salin contoh vhost, ganti `<domain>`:
   ```bash
   sudo cp deploy/vps/nginx-mih.conf.example /etc/nginx/sites-available/mih.go.id
   # ganti semua mih.<domain>.go.id dengan domain asli
   sudo nano /etc/nginx/sites-available/mih.go.id
   sudo ln -s /etc/nginx/sites-available/mih.go.id /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
2. Setup renewal certbot otomatis (biasanya otomatis via systemd timer `certbot.timer`),
   lalu tambah hook reload nginx bila perlu.

### 6. Deploy stack MIH
```bash
# Di server, clone repo (atau pull yang sudah ada)
git clone https://github.com/hrmaulana/mih-ai-platform.git mih
cd mih

# Buat env produksi dari template, isi nilai asli
cp .env.example.prod .env.prod
nano .env.prod   # isi OPENAI_API_KEY, ADMIN_*, SESSION_SECRET, dll.

# Build & jalankan (proxy kosong jika VPS punya internet langsung)
bash scripts/deploy-prod.sh
```

### 7. Seed admin (sekali)
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm seed
```
Idempotent — aman dijalankan ulang (update `is_admin` bila email sudah ada).

### 8. Verifikasi
- `curl -I https://mih.<domain>.go.id` → `HTTP/2 200`, header security ada.
- Buka di browser → login admin → **Playground** (tanya dokumen) → **Dokumen**
  (upload & status ingesti) → **Admin** (buat user/token, log pemakaian).
- Cek log: `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f --tail=50 backend worker`

---

## Operasi rutin

| Tindakan | Perintah |
|---|---|
| Deploy ulang (build baru) | `bash scripts/deploy-prod.sh` |
| Lihat status | `docker compose --env-file .env.prod -f docker-compose.prod.yml ps` |
| Log backend/worker | `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend` |
| Update admin password | ubah `ADMIN_PASSWORD` di `.env.prod`, lalu `run --rm seed` |
| Backup DB | `docker compose --env-file .env.prod -f docker-compose.prod.yml exec db pg_dump -U mih mih > backup.sql` |

---

## Catatan keamanan
- `.env.prod` berisi `OPENAI_API_KEY` & kredensial admin — **jangan commit**, jangan
  kirim ke chat/issue. Template `.env.example.prod` aman untuk commit (placeholder).
- VPS harus bisa keluar ke `api.openai.com` (OpenAI key aktif). Bila di belakang
  proxy korporat, set `HTTP_PROXY`/`HTTPS_PROXY` saat menjalankan `deploy-prod.sh`.
- DB tidak terekspos ke host — hanya bisa diakses dari dalam jaringan Docker.
