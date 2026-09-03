#!/usr/bin/env bash
# Deploy MIH ke VPS publik (vps.arthakarya.id). Dipanggil oleh job deploy-vps
# di workflow Deploy (runner self-hosted label `vps`) atau manual di VPS.
#
# Repo persisten di $HOME/mi (bukan checkout per-run). Compose project DIPAKSA
# "mih" karena stack awal dibuat dari /root/mih — tanpa -p mih, compose akan
# membuat container/volume baru bernama mi-* dan portal lama tetap berjalan.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [ ! -f .env.prod ]; then
  echo ".env.prod belum ada di $DIR — salin dari backup: cp ~/mih.old/.env.prod .env.prod" >&2
  exit 1
fi

COMPOSE="docker compose -p mih --env-file .env.prod -f docker-compose.prod.yml"

echo "=== deploy VPS di: $DIR ==="

# Build sekuensial per service (sama seperti deploy-prod.sh) + retry: unduhan
# besar kadang di-reset jaringan.
build_service() {
  local svc="$1"
  for i in 1 2 3; do
    echo "=== $COMPOSE build $svc (attempt $i) ==="
    if $COMPOSE build "$svc"; then
      return 0
    fi
    echo "build $svc gagal attempt $i, coba lagi dalam 15s..."
    sleep 15
  done
  echo "build $svc gagal 3x berturut-turut — periksa log di atas." >&2
  return 1
}

build_service backend
build_service frontend
build_service worker

echo "=== $COMPOSE up -d --no-build ==="
$COMPOSE up -d --no-build

echo "=== verifikasi portal ==="
# Verifikasi dari DALAM container frontend (kebal proxy & isu localhost runner).
portal_ok() {
  $COMPOSE exec -T frontend wget -q -O /dev/null http://127.0.0.1/ 2>/dev/null
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
echo "=== deploy VPS selesai ==="
