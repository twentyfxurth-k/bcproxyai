#!/usr/bin/env bash
# Run this on the droplet after `git pull`.
# Assumes /etc/caddy/Caddyfile already has the smlgateway site block
# (see docs/DEPLOY.md) and .env.production is filled in.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.production ]]; then
  echo "ERROR: .env.production not found. Copy from .env.production.example and fill in secrets." >&2
  exit 1
fi

echo "==> Building and starting containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "==> Waiting for health..."
for i in {1..30}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8335/api/health || echo 000)
  if [[ "$code" == "200" ]]; then
    echo "    health OK (${i}s)"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: health check never returned 200 within 30s (last=${code})" >&2
    docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail 50 sml-gateway
    exit 1
  fi
  sleep 1
done

echo "==> Verifying container state..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo
echo "Deploy complete. Test through Cloudflare:"
echo "    curl -s -o /dev/null -w '%{http_code}\\n' https://smlgateway.smlsoftdemo.com/api/health"
