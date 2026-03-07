#!/bin/bash
set -euo pipefail

PROJECT_DIR="/home/cc2/game01"
BACKUP_DIR="$PROJECT_DIR/.deploy-backup"

echo "=== Capybara Runner Deploy ==="

# 0. Pre-deploy DB backup
echo "[0/5] Backing up database before deploy..."
BACKUP_SCRIPT="$PROJECT_DIR/deploy/backup-db.sh"
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "ERROR: Backup script not found at $BACKUP_SCRIPT — aborting deploy."
    exit 1
fi
if ! bash "$BACKUP_SCRIPT"; then
    echo "ERROR: Database backup failed — aborting deploy."
    exit 1
fi
echo "[0/5] Database backup successful."

echo "=== Running client tests ==="
cd "$PROJECT_DIR/client" && npm test && cd "$PROJECT_DIR"

echo "=== Running server tests ==="
cd "$PROJECT_DIR/server" && cargo test && cd "$PROJECT_DIR"

# 1. Save previous build for rollback
echo "[1/5] Saving previous build for rollback..."
mkdir -p "$BACKUP_DIR"
if [ -d "$PROJECT_DIR/client/dist" ]; then
    rm -rf "$BACKUP_DIR/client-dist"
    cp -r "$PROJECT_DIR/client/dist" "$BACKUP_DIR/client-dist"
fi
if [ -f "$PROJECT_DIR/server/target/release/capybara-runner-server" ]; then
    cp "$PROJECT_DIR/server/target/release/capybara-runner-server" "$BACKUP_DIR/capybara-runner-server"
fi
echo "[1/5] Previous build saved to $BACKUP_DIR"

# 2. Client build
echo "[2/5] Building client..."
cd "$PROJECT_DIR/client"
npm run build

# 3. Server build
echo "[3/5] Building server..."
cd "$PROJECT_DIR/server"
cargo build --release

# 4. Restart service
echo "[4/5] Restarting service..."
sudo systemctl restart capybara-api || echo "Warning: systemctl restart failed (service may not exist yet)"

# 5. Post-deploy health check (with rollback on failure)
echo "[5/5] Running health check..."
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
    echo "[5/5] Health check PASSED — API server is running."
else
    echo "ERROR: Health check failed after 5 attempts. Rolling back..."
    if [ -d "$BACKUP_DIR/client-dist" ]; then
        rm -rf "$PROJECT_DIR/client/dist"
        cp -r "$BACKUP_DIR/client-dist" "$PROJECT_DIR/client/dist"
        echo "  Client rollback complete."
    fi
    if [ -f "$BACKUP_DIR/capybara-runner-server" ]; then
        cp "$BACKUP_DIR/capybara-runner-server" "$PROJECT_DIR/server/target/release/capybara-runner-server"
        sudo systemctl restart capybara-api || true
        echo "  Server rollback complete."
    fi
    echo "ERROR: Deploy failed — rolled back to previous build. Check: sudo systemctl status capybara-api"
    exit 1
fi

# 6. Ensure DB backup cron is registered (idempotent)
BACKUP_CMD="0 */6 * * * $PROJECT_DIR/deploy/backup-db.sh >> /var/log/capybara-backup.log 2>&1"
if ! crontab -l 2>/dev/null | grep -qF "backup-db.sh"; then
    (crontab -l 2>/dev/null; echo "$BACKUP_CMD") | crontab -
    echo "DB backup cron registered (every 6 hours)"
else
    echo "DB backup cron already registered"
fi

echo "=== Deploy complete ==="
