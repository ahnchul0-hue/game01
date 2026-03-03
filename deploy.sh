#!/bin/bash
set -euo pipefail

PROJECT_DIR="/home/cc2/game01"

echo "=== Capybara Runner Deploy ==="

echo "=== Running client tests ==="
cd "$PROJECT_DIR/client" && npm test && cd "$PROJECT_DIR"

echo "=== Running server tests ==="
cd "$PROJECT_DIR/server" && cargo test && cd "$PROJECT_DIR"

# 1. Client build
echo "[1/3] Building client..."
cd "$PROJECT_DIR/client"
npm run build

# 2. Server build
echo "[2/3] Building server..."
cd "$PROJECT_DIR/server"
cargo build --release

# 3. Restart service
echo "[3/3] Restarting service..."
sudo systemctl restart capybara-api || echo "Warning: systemctl restart failed (service may not exist yet)"

echo "=== Deploy complete ==="
