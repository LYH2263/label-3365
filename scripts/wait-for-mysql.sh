#!/usr/bin/env bash
set -euo pipefail

MAX_RETRY=${1:-60}

for ((i=1; i<=MAX_RETRY; i++)); do
  if docker compose exec -T mysql mysqladmin ping -h127.0.0.1 -uroot -proot --silent >/dev/null 2>&1; then
    echo "MySQL 已就绪"
    exit 0
  fi
  echo "等待 MySQL 就绪... (${i}/${MAX_RETRY})"
  sleep 2
done

echo "MySQL 启动超时"
exit 1
