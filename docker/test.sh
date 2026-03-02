#!/usr/bin/env bash
# Run the two-node P2P Docker test.
# Usage: ./docker/test.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Building images ==="
docker compose -f docker/docker-compose.yml build

echo ""
echo "=== Starting server (node-a) ==="
docker compose -f docker/docker-compose.yml up -d node-a

echo ""
echo "=== Running client (node-b) ==="
if docker compose -f docker/docker-compose.yml run --rm --no-deps node-b; then
  CLIENT_PASS=true
else
  CLIENT_PASS=false
fi

echo ""
echo "=== Server logs (node-a) ==="
docker compose -f docker/docker-compose.yml logs node-a

echo ""
echo "=== Cleaning up ==="
docker compose -f docker/docker-compose.yml down

if [ "$CLIENT_PASS" = "true" ]; then
  echo ""
  echo "=== PASS: P2P test completed successfully ==="
else
  echo ""
  echo "=== FAIL: client exited with non-zero status ==="
  exit 1
fi
