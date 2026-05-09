#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

APP_HOST_PORT=${APP_HOST_PORT:-8080}

docker compose down -v >/dev/null 2>&1 || true
docker compose up -d --build

for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/health" >/dev/null 2>&1; then
    cat <<EOF
演示环境已启动
访问地址: http://127.0.0.1:${APP_HOST_PORT}/login.html

默认账号:
- 商家: merchant_admin / Merchant@123
- 顾客: customer_test / Customer@123

如需停止:
- pnpm docker:down
EOF
    exit 0
  fi
  sleep 1
done

echo "应用启动超时，请执行 'docker compose logs app mysql' 查看日志。" >&2
exit 1
