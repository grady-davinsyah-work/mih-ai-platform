#!/usr/bin/env bash
set -euo pipefail
# Menjalankan pgvector untuk development & test di host (port 5432).
if ! docker ps -a --format '{{.Names}}' | grep -q '^mih-dev-db$'; then
  docker run --name mih-dev-db -e POSTGRES_USER=mih -e POSTGRES_PASSWORD=mih \
    -d -p 5432:5432 pgvector/pgvector:pg16
fi
until docker exec mih-dev-db pg_isready -U mih >/dev/null 2>&1; do sleep 1; done
docker exec mih-dev-db psql -U mih -tAc "SELECT 1 FROM pg_database WHERE datname='mih_test'" \
  | grep -q 1 || docker exec mih-dev-db createdb -U mih mih_test
echo "db siap: mih@localhost:5432/mih (app) dan /mih_test (tests)"
