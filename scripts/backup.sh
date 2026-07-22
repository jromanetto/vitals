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

# Cron runs with a near-empty environment and does not read any shell profile,
# so VITALS_BACKUP_REMOTE has to come from a file the script sources itself.
# data/ is gitignored and chmod 700, which is where the other secrets already
# live. Absent file = offsite copy stays disabled, which is the safe default.
ENV_FILE="$DATA_DIR/backup.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

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

# Restore verification. An encrypted blob nobody has ever decrypted is not a
# backup — a silently rotated key, a truncated write or a bad openssl flag all
# produce a file of plausible size that restores to nothing. So decrypt what we
# just wrote, open it as SQLite, and check it is a usable database. This is
# fatal on purpose: a backup that cannot be restored should fail the cron job
# loudly rather than accumulate quietly for months.
VERIFY_FILE="$(mktemp "/tmp/vitals-verify-XXXXXX.db")"
trap 'rm -f "$VERIFY_FILE"' EXIT

if ! openssl enc -d -aes-256-cbc -pbkdf2 \
      -in "$OUT_FILE" -out "$VERIFY_FILE" -pass "file:$KEY_FILE" 2>/dev/null; then
  echo "[backup] FATAL restore check: cannot decrypt $OUT_FILE (wrong or rotated key?)" >&2
  exit 1
fi

INTEGRITY="$(sqlite3 "$VERIFY_FILE" 'PRAGMA integrity_check;' 2>&1 | head -1)"
if [ "$INTEGRITY" != "ok" ]; then
  echo "[backup] FATAL restore check: integrity_check said '$INTEGRITY'" >&2
  exit 1
fi

# Structural check on top of integrity_check, which passes on a well-formed but
# empty database. `user` is the table whose loss would be unrecoverable: without
# it nobody can log in, even with every other table intact.
USERS="$(sqlite3 "$VERIFY_FILE" 'SELECT COUNT(*) FROM user;' 2>/dev/null || echo 0)"
if [ "${USERS:-0}" -lt 1 ]; then
  echo "[backup] FATAL restore check: restored DB has no rows in 'user'" >&2
  exit 1
fi

rm -f "$VERIFY_FILE"
trap - EXIT
echo "[backup] restore check ok (integrity_check=ok, users=$USERS)"

find "$BACKUP_DIR" -name "*.db.enc" -mtime +30 -delete

# Optional offsite copy — the local backups live on the same VPS as the DB, so
# a server loss would take them with it. Set VITALS_BACKUP_REMOTE to an rclone
# remote (e.g. "r2:vitals-backups" for Cloudflare R2) to push the encrypted
# file off-box. No-op when unset or rclone is missing, so it's safe to ship.
if [ -n "${VITALS_BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  if rclone copy "$OUT_FILE" "$VITALS_BACKUP_REMOTE" --quiet; then
    echo "[backup] offsite copy -> $VITALS_BACKUP_REMOTE ok"
    # Same 30-day window as local, applied remotely. Without this the bucket
    # grows by ~147 MB every night forever.
    rclone delete "$VITALS_BACKUP_REMOTE" --min-age 30d --quiet \
      || echo "[backup] WARNING offsite prune failed" >&2
  else
    echo "[backup] WARNING offsite copy to $VITALS_BACKUP_REMOTE FAILED" >&2
  fi
elif [ -z "${VITALS_BACKUP_REMOTE:-}" ]; then
  echo "[backup] offsite copy skipped: VITALS_BACKUP_REMOTE unset (see $ENV_FILE)"
else
  echo "[backup] offsite copy skipped: rclone not installed"
fi

SIZE=$(stat -c %s "$OUT_FILE" 2>/dev/null || stat -f %z "$OUT_FILE" 2>/dev/null || echo "?")
echo "[backup] $(date -Iseconds) ok size=${SIZE} -> $OUT_FILE"
