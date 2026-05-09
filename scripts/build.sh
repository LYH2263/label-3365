#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

mvn -q -f backend/pom.xml -DskipTests package

echo "build 完成: backend/target/chuanzi-restaurant-assistant.jar"
