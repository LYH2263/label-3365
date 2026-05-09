#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

APP_PORT=${APP_PORT:-8080}
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3307}
DB_NAME=${DB_NAME:-chuanzi}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD:-root}
SESSION_TTL_HOURS=${SESSION_TTL_HOURS:-24}
APP_PASSWORD_SALT=${APP_PASSWORD_SALT:-chuanzi-default-salt}
WEB_ROOT=${WEB_ROOT:-$ROOT_DIR/web}

mvn -q -f backend/pom.xml -DskipTests package

APP_PORT="$APP_PORT" \
DB_HOST="$DB_HOST" \
DB_PORT="$DB_PORT" \
DB_NAME="$DB_NAME" \
DB_USER="$DB_USER" \
DB_PASSWORD="$DB_PASSWORD" \
SESSION_TTL_HOURS="$SESSION_TTL_HOURS" \
APP_PASSWORD_SALT="$APP_PASSWORD_SALT" \
WEB_ROOT="$WEB_ROOT" \
java -jar backend/target/chuanzi-restaurant-assistant.jar
