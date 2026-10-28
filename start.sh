#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

docker compose up -d --build
echo "Readwise is running at http://localhost:${APP_PORT:-18743}"
