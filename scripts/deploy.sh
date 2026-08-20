#!/usr/bin/env bash
# Deploy MIH di server Arthakarya: build ulang image & restart stack docker.
# Dipanggil oleh workflow Deploy (GitHub Actions, self-hosted runner) atau manual.
set -euo pipefail

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
    if docker compose build "$svc"; then
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
curl -sf --noproxy "*" -o /dev/null -w "portal HTTP %{http_code}\n" http://localhost:8080/ \
  || { echo "portal tidak responsif di localhost:8080" >&2; exit 1; }

echo "=== status container ==="
docker compose ps
echo "=== deploy selesai ==="
