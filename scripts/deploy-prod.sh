#!/usr/bin/env bash
# Deploy MIH produksi ke VPS: build ulang image & restart stack.
# Pakai docker-compose.prod.yml (pola Arthakarya) — db/backend/worker tanpa
# host port, frontend bind 127.0.0.1:8080, TLS oleh reverse proxy host.
#
# Prasyarat: `.env.prod` sudah ada (cp .env.example.prod .env.prod lalu isi).
set -euo pipefail

# Proxy KORPORAT opsional. VPS normal punya internet langsung -> kosong.
# Bila VPS di belakang proxy, set variabel ini sebelum menjalankan script:
#   HTTP_PROXY=http://proxy.bappenas.go.id:8080 HTTPS_PROXY=http://proxy.bappenas.go.id:8080 bash scripts/deploy-prod.sh
export HTTP_PROXY="${HTTP_PROXY:-}"
export HTTPS_PROXY="${HTTPS_PROXY:-}"
export NO_PROXY="${NO_PROXY:-localhost,127.0.0.1}"

# Direktori repo deploy di VPS (clone git dari GitHub). Jangan taruh .env.prod di git.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [ ! -f .env.prod ]; then
  echo ".env.prod belum ada — salin dulu: cp .env.example.prod .env.prod" >&2
  exit 1
fi

COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"

echo "=== deploy di: $DIR ==="

# Build SEKUSENSIAL per service. Build paralel (default compose) membuat proxy
# korporat kewalahan sehingga unduhan saling berebut & sering reset koneksi.
# Retry per service karena proxy kadang me-reset unduhan besar.
build_service() {
  local svc="$1"
  for i in 1 2 3 4 5; do
    echo "=== $COMPOSE build $svc (attempt $i) ==="
    # --build-arg proxy: BuildKit auto-inject ini ke env RUN steps, jadi unduhan
    # bun/pip/npm pasti lewat proxy walau env client kebetulan tidak ter-set.
    if $COMPOSE build \
        --build-arg HTTP_PROXY="$HTTP_PROXY" \
        --build-arg HTTPS_PROXY="$HTTPS_PROXY" \
        --build-arg NO_PROXY="$NO_PROXY" \
        "$svc"; then
      return 0
    fi
    echo "build $svc gagal attempt $i, coba lagi dalam 15s..."
    sleep 15
  done
  echo "build $svc gagal 5x berturut-turut — periksa log di atas." >&2
  return 1
}

build_service backend
build_service frontend
build_service worker

echo "=== $COMPOSE up -d --no-build ==="
$COMPOSE up -d --no-build

echo "=== verifikasi portal (127.0.0.1:8080) ==="
# Verifikasi UTAMA lewat `docker compose exec` ke dalam container frontend:
# akurat walau runner CI berjalan di dalam container (localhost != host) dan
# kebal proxy korporat (tidak lewat jaringan host sama sekali).
# nginx:alpine punya busybox wget. Fallback: curl dari host dengan proxy dimatikan.
portal_ok() {
  $COMPOSE exec -T frontend wget -q -O /dev/null http://127.0.0.1/ 2>/dev/null \
    || curl -sf --noproxy "*" --max-time 5 -o /dev/null http://127.0.0.1:8080/
}
ok=""
for i in $(seq 1 20); do
  if portal_ok; then
    ok=1
    echo "portal HTTP 200 (detik ke-$((i * 3)))"
    break
  fi
  sleep 3
done
if [ -z "$ok" ]; then
  echo "portal tidak responsif dalam 60s — status container:" >&2
  $COMPOSE ps >&2
  $COMPOSE logs --tail 30 frontend >&2
  exit 1
fi

echo "=== status container ==="
$COMPOSE ps
echo "=== deploy selesai ==="
echo "Seed admin (jalankan sekali): $COMPOSE run --rm seed"
