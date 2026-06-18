#!/usr/bin/env bash
# Daily encrypted SQLite backup for Vitals.
set -euo pipefail

VITALS_DIR="/home/script/vitals"
DATA_DIR="$VITALS_DIR/data"
BACKUP_DIR="$DATA_DIR/backups"
KEY_FILE="$DATA_DIR/.backup-key"
DB_FILE="$DATA_DIR/vitals.db"
DATE="$(date +%Y-%m-%d)"
TMP_FILE="/tmp/vitals-${DATE}.db"
OUT_FILE="$BACKUP_DIR/vitals-${DATE}.db.enc"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$KEY_FILE" ]; then
  echo "[backup] generating new backup key at $KEY_FILE"
  openssl rand -hex 64 > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
fi

sqlite3 "$DB_FILE" ".backup $TMP_FILE"

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$TMP_FILE" \
  -out "$OUT_FILE" \
  -pass "file:$KEY_FILE"

rm -f "$TMP_FILE"

find "$BACKUP_DIR" -name "*.db.enc" -mtime +30 -delete

# Optional offsite copy — the local backups live on the same VPS as the DB, so
# a server loss would take them with it. Set VITALS_BACKUP_REMOTE to an rclone
# remote (e.g. "r2:vitals-backups" for Cloudflare R2) to push the encrypted
# file off-box. No-op when unset or rclone is missing, so it's safe to ship.
if [ -n "${VITALS_BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  if rclone copy "$OUT_FILE" "$VITALS_BACKUP_REMOTE" --quiet; then
    echo "[backup] offsite copy -> $VITALS_BACKUP_REMOTE ok"
  else
    echo "[backup] WARNING offsite copy to $VITALS_BACKUP_REMOTE FAILED" >&2
  fi
else
  echo "[backup] offsite copy skipped (set VITALS_BACKUP_REMOTE + install rclone to enable)"
fi

SIZE=$(stat -c %s "$OUT_FILE" 2>/dev/null || stat -f %z "$OUT_FILE" 2>/dev/null || echo "?")
echo "[backup] $(date -Iseconds) ok size=${SIZE} -> $OUT_FILE"
