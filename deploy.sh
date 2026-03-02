#!/bin/bash
set -euo pipefail

PROJECT_DIR="/home/cc2/game01"

echo "=== Capybara Runner Deploy ==="

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
