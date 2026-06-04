#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  PostgreSQL restore from encrypted backup
#
#  Usage:
#    BACKUP_ENCRYPTION_KEY=... POSTGRES_USER=... POSTGRES_DB=... \
#      ./scripts/restore-db.sh /path/to/dump-YYYYMMDD_HHMMSS.sql.gz.gpg
#
#  Steps:
#    1. Verify sha256 sidecar (if present)
#    2. Decrypt with gpg AES-256
#    3. Pipe gunzip → psql into POSTGRES_DB
#
#  This is destructive: the target database receives the dump as-is.
#  Always test on a staging DB first.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <encrypted-backup.sql.gz.gpg>" >&2
  exit 2
fi

ENC_FILE="$1"
[[ -f "${ENC_FILE}" ]] || { echo "file not found: ${ENC_FILE}" >&2; exit 1; }

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

command -v gpg >/dev/null 2>&1   || { echo "gpg not installed" >&2; exit 1; }
command -v psql >/dev/null 2>&1  || { echo "psql not installed" >&2; exit 1; }
command -v gunzip >/dev/null 2>&1 || { echo "gunzip not installed" >&2; exit 1; }

# Optional sha256 verification.
SUM_FILE="${ENC_FILE}.sha256"
if [[ -f "${SUM_FILE}" ]]; then
  echo "Verifying sha256 …"
  ( cd "$(dirname "${ENC_FILE}")" && sha256sum -c "$(basename "${SUM_FILE}")" )
else
  echo "WARNING: no .sha256 sidecar found next to ${ENC_FILE}" >&2
fi

# Confirmation prompt.
echo
echo "About to RESTORE into:"
echo "  host = ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "  db   = ${POSTGRES_DB}"
echo "  user = ${POSTGRES_USER}"
echo "  src  = ${ENC_FILE}"
echo
read -r -p "Type the database name '${POSTGRES_DB}' to confirm: " CONFIRM
if [[ "${CONFIRM}" != "${POSTGRES_DB}" ]]; then
  echo "Aborted." >&2
  exit 1
fi

echo "[$(date -Iseconds)] Starting restore …"

printf '%s' "${BACKUP_ENCRYPTION_KEY}" \
  | gpg --batch --quiet \
        --pinentry-mode loopback \
        --passphrase-fd 0 \
        --decrypt "${ENC_FILE}" \
  | gunzip \
  | psql \
      -h "${POSTGRES_HOST}" \
      -p "${POSTGRES_PORT}" \
      -U "${POSTGRES_USER}" \
      -d "${POSTGRES_DB}" \
      --set ON_ERROR_STOP=on

echo "[$(date -Iseconds)] Restore complete."
