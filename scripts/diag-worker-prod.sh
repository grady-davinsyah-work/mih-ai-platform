#!/usr/bin/env bash
# Diagnosa "Request timed out" di VPS PRODUKSI MIH.
# Jalankan DI VPS, di direktori repo mih:
#   bash scripts/diag-worker-prod.sh
set -u

COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"
echo "===== 1. Status container ====="
$COMPOSE ps 2>&1

echo ""
echo "===== 2. Env proxy / OpenAI di worker ====="
docker inspect mih-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' 2>&1 \
  | grep -iE 'proxy|openai|http|raw|data' || echo "(nama container mungkin berbeda — coba: docker ps | grep worker)"

echo ""
echo "===== 3. Status dokumen di DB (cari failed/pending) ====="
$COMPOSE exec -T db psql -U ${POSTGRES_USER:-mih} -d ${POSTGRES_DB:-mih} -c \
  "SELECT id, filename, status, error_message, chunk_count, updated_at FROM documents ORDER BY id DESC LIMIT 15;" 2>&1

echo ""
echo "===== 4. Koneksi ke api.openai.com dari worker container ====="
WORKER_CTR=$($COMPOSE ps -q worker 2>/dev/null | head -1)
echo "worker container: $WORKER_CTR"
docker exec "$WORKER_CTR" sh -c '
  echo "--- proxy env di container ---"
  env | grep -i proxy || echo "(tidak ada env proxy)"
  echo "--- TLS ke api.openai.com (timeout 20s) ---"
  python - <<'"'"'PY'"'"'
import socket, ssl, time
s=time.time()
try:
    ctx=ssl.create_default_context()
    with socket.create_connection(("api.openai.com",443),timeout=15) as sock:
        with ctx.wrap_socket(sock,server_hostname="api.openai.com") as ss:
            print(f"TLS OK ke api.openai.com:443 dalam {time.time()-s:.1f}s")
except Exception as e:
    print(f"GAGAL dalam {time.time()-s:.1f}s: {type(e).__name__}: {e}")
PY
' 2>&1

echo ""
echo "===== 5. Log worker (cari Request timed out / fail) ====="
$COMPOSE logs --tail 50 worker 2>&1
