#!/bin/bash
set -euo pipefail

PROJECT_DIR="/home/cc2/game01"

echo "=== Capybara Runner Deploy ==="

# 0. Pre-deploy DB backup
echo "[0/4] Backing up database before deploy..."
BACKUP_SCRIPT="$PROJECT_DIR/deploy/backup-db.sh"
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "ERROR: Backup script not found at $BACKUP_SCRIPT — aborting deploy."
    exit 1
fi
if ! bash "$BACKUP_SCRIPT"; then
    echo "ERROR: Database backup failed — aborting deploy."
    exit 1
fi
echo "[0/4] Database backup successful."

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
echo "[3/4] Restarting service..."
sudo systemctl restart capybara-api || echo "Warning: systemctl restart failed (service may not exist yet)"

# 4. Post-deploy health check
echo "[4/4] Running health check..."
HEALTH_OK=false
for i in 1 2 3 4 5; do
    sleep 1
    if curl -sf http://127.0.0.1:3000/api/health | grep -q '"status":"ok"'; then
        HEALTH_OK=true
        break
    fi
    echo "  Health check attempt $i/5 failed, retrying..."
done
if [ "$HEALTH_OK" = true ]; then
    echo "[4/4] Health check PASSED — API server is running."
else
    echo "WARNING: Health check failed after 5 attempts. Check: sudo systemctl status capybara-api"
fi

# 5. Ensure DB backup cron is registered (idempotent)
BACKUP_CMD="0 */6 * * * $PROJECT_DIR/deploy/backup-db.sh >> /var/log/capybara-backup.log 2>&1"
if ! crontab -l 2>/dev/null | grep -qF "backup-db.sh"; then
    (crontab -l 2>/dev/null; echo "$BACKUP_CMD") | crontab -
    echo "[4/4] DB backup cron registered (every 6 hours)"
else
    echo "[4/4] DB backup cron already registered"
fi

echo "=== Deploy complete ==="
