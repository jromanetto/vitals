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

SIZE=$(stat -c %s "$OUT_FILE" 2>/dev/null || stat -f %z "$OUT_FILE" 2>/dev/null || echo "?")
echo "[backup] $(date -Iseconds) ok size=${SIZE} -> $OUT_FILE"
