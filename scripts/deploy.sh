#!/usr/bin/env bash
# Deploy MIH di server Arthakarya: build ulang image & restart stack docker.
# Dipanggil oleh workflow Deploy (GitHub Actions, self-hosted runner) atau manual.
set -euo pipefail

# Proxy korporat wajib untuk semua unduhan saat build (bun/pip/npm). Server tidak
# punya internet langsung; tanpa proxy, RUN steps hang selamanya menunggu koneksi.
export HTTP_PROXY=http://proxy.bappenas.go.id:8080
export HTTPS_PROXY=http://proxy.bappenas.go.id:8080
export NO_PROXY=localhost,127.0.0.1

# Direktori repo deploy di server (clone git dari GitHub). Jangan pernah taruh .env di git.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== deploy di: $DIR ==="

# Build SEKUSENSIAL per service. Build paralel (default compose) memenuhi proxy
# korporat sehingga unduhan wheel/npm/bun saling berebut & sering reset koneksi.
# Retry per service karena proxy kadang me-reset unduhan besar.
build_service() {
  local svc="$1"
  for i in 1 2 3 4 5; do
    echo "=== docker compose build $svc (attempt $i) ==="
    # --build-arg proxy: BuildKit auto-inject ini ke env RUN steps, jadi unduhan
    # bun/pip/npm pasti lewat proxy walau env client kebetulan tidak ter-set.
    if docker compose build \
        --build-arg HTTP_PROXY=http://proxy.bappenas.go.id:8080 \
        --build-arg HTTPS_PROXY=http://proxy.bappenas.go.id:8080 \
        --build-arg NO_PROXY=localhost,127.0.0.1 \
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

echo "=== docker compose up -d --no-build ==="
docker compose up -d --no-build

echo "=== verifikasi portal ==="
# Verifikasi UTAMA lewat `docker compose exec` ke dalam container frontend:
# akurat walau runner CI berjalan di dalam container (localhost != host) dan
# kebal proxy korporat (tidak lewat jaringan host sama sekali).
# nginx:alpine punya busybox wget. Fallback: curl dari host dengan proxy dimatikan.
portal_ok() {
  docker compose exec -T frontend wget -q -O /dev/null http://127.0.0.1/ 2>/dev/null \
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
  docker compose ps >&2
  docker compose logs --tail 30 frontend >&2
  exit 1
fi

echo "=== status container ==="
docker compose ps
echo "=== deploy selesai ==="
