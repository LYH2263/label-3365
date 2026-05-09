#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

pnpm exec eslint "web/assets/js/**/*.js" "scripts/*.mjs" "e2e/**/*.js"
mvn -q -f backend/pom.xml -DskipTests compile

echo "lint 通过"
