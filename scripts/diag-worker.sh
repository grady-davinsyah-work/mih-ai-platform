#!/usr/bin/env bash
# Diagnosa worker MIH: kenapa dokumen berstatus 'failed' dengan "Request timed out".
# Jalankan:  bash scripts/diag-worker.sh
set -u

echo "===== 1. Env proxy / OpenAI di worker ====="
docker inspect mvpmih-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' 2>&1 \
  | grep -iE 'proxy|openai|http|raw|data' || echo "(tidak ada env proxy/openai di worker)"

echo ""
echo "===== 2. Status dokumen di DB ====="
docker exec mvpmih-db-1 psql -U mih -d mih -c \
  "SELECT id, filename, status, error_message, chunk_count, updated_at FROM documents ORDER BY id DESC LIMIT 10;" 2>&1

echo ""
echo "===== 3. Uji koneksi ke api.openai.com dari dalam worker (tanpa proxy) ====="
docker exec mvpmih-worker-1 sh -c '
  echo "--- DNS ---"
  getent hosts api.openai.com || echo "DNS GAGAL"
  echo "--- HTTPS (timeout 20s) ---"
  if command -v wget >/dev/null; then
    wget -q -O /dev/null --timeout=20 https://api.openai.com/v1/models || echo "CONNECT GAGAL/TIMEOUT -> root cause kemungkinan jaringan ke OpenAI"
  else
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
  fi
'
