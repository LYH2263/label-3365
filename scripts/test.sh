#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

APP_PID=""

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" >/dev/null 2>&1 || true
  fi
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose up -d mysql
bash scripts/wait-for-mysql.sh

docker compose exec -T mysql mysql --default-character-set=utf8mb4 -uroot -proot -e "DROP DATABASE IF EXISTS chuanzi;"
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -uroot -proot < "$ROOT_DIR/sql/schema.sql"
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -uroot -proot < "$ROOT_DIR/sql/seed.sql"

mvn -q -f backend/pom.xml -DskipTests package

APP_PORT=18080 \
DB_HOST=127.0.0.1 \
DB_PORT=3307 \
DB_NAME=chuanzi \
DB_USER=root \
DB_PASSWORD=root \
SESSION_TTL_HOURS=24 \
APP_PASSWORD_SALT=chuanzi-default-salt \
WEB_ROOT="$ROOT_DIR/web" \
java -jar backend/target/chuanzi-restaurant-assistant.jar > /tmp/chuanzi-app.log 2>&1 &
APP_PID=$!

for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:18080/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 30 ]]; then
    echo "应用启动失败，请查看 /tmp/chuanzi-app.log"
    exit 1
  fi
done

pnpm exec playwright install chromium
pnpm e2e
node scripts/cart.test.mjs

echo "test 通过"
