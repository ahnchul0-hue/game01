#!/bin/bash
# SQLite backup script — run via cron: 0 */6 * * * /home/cc2/game01/deploy/backup-db.sh
set -euo pipefail

BACKUP_DIR="/home/cc2/backups/capybara"
DB_PATH="/home/cc2/game01/server/data.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_PATH" ".backup ${BACKUP_DIR}/data-${TIMESTAMP}.db"

# Keep only last 30 backups
ls -t "${BACKUP_DIR}"/data-*.db 2>/dev/null | tail -n +31 | xargs -r rm
echo "[$(date)] Backup completed: data-${TIMESTAMP}.db"
