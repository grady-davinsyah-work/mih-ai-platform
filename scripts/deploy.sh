#!/usr/bin/env bash
# Deploy MIH di server Arthakarya: build ulang image & restart stack docker.
# Dipanggil oleh workflow Deploy (GitHub Actions, self-hosted runner) atau manual.
set -euo pipefail

# Direktori repo deploy di server (clone git dari GitHub). Jangan pernah taruh .env di git.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== deploy di: $DIR ==="

# Proxy korporat kadang me-reset pull layer besar → ulangi beberapa kali.
for i in 1 2 3 4 5; do
  echo "=== docker compose up -d --build (attempt $i) ==="
  if docker compose up -d --build; then
    break
  fi
  echo "build gagal di attempt $i, coba lagi dalam 15s..."
  sleep 15
  if [ "$i" -eq 5 ]; then
    echo "build gagal 5x berturut-turut — periksa log di atas." >&2
    exit 1
  fi
done

echo "=== verifikasi portal ==="
curl -sf --noproxy "*" -o /dev/null -w "portal HTTP %{http_code}\n" http://localhost:8080/ \
  || { echo "portal tidak responsif di localhost:8080" >&2; exit 1; }

echo "=== status container ==="
docker compose ps
echo "=== deploy selesai ==="
