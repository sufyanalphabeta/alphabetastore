#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  PostgreSQL daily backup script — encrypted (GPG AES-256)
#
#  Required environment:
#    POSTGRES_USER, POSTGRES_DB, BACKUP_ENCRYPTION_KEY
#  Optional:
#    POSTGRES_HOST (default localhost), POSTGRES_PORT (5432),
#    PGPASSWORD, BACKUP_DIR (./backups), RETENTION_DAYS (7),
#    BACKUP_S3_BUCKET, BACKUP_S3_PREFIX (alphabeta-postgres),
#    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION.
#
#  Output files in BACKUP_DIR:
#    ${POSTGRES_DB}-YYYYMMDD_HHMMSS.sql.gz.gpg          (encrypted dump)
#    ${POSTGRES_DB}-YYYYMMDD_HHMMSS.sql.gz.gpg.sha256   (integrity sidecar)
#
#  Restore with scripts/restore-db.sh — see BACKUPS.md.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-alphabeta-postgres}"

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found" >&2; exit 1; }
command -v gpg >/dev/null 2>&1 || { echo "gpg not found — install gnupg" >&2; exit 1; }

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PLAIN_FILE="${BACKUP_DIR}/${POSTGRES_DB}-${TIMESTAMP}.sql.gz"
ENC_FILE="${PLAIN_FILE}.gpg"
SUM_FILE="${ENC_FILE}.sha256"

echo "[$(date -Iseconds)] Starting backup: ${ENC_FILE}"

pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  "${POSTGRES_DB}" \
  | gzip > "${PLAIN_FILE}"

# Symmetric encryption with AES-256. Passphrase is read from stdin so it is not
# visible in the process list / argv.
printf '%s' "${BACKUP_ENCRYPTION_KEY}" \
  | gpg --batch --yes --quiet \
        --pinentry-mode loopback \
        --passphrase-fd 0 \
        --cipher-algo AES256 \
        --symmetric \
        -o "${ENC_FILE}" \
        "${PLAIN_FILE}"

# Plaintext dump never persists on disk.
rm -f "${PLAIN_FILE}"

# Integrity sidecar so restores can verify the file before decrypting.
( cd "${BACKUP_DIR}" && sha256sum "$(basename "${ENC_FILE}")" > "$(basename "${SUM_FILE}")" )

echo "[$(date -Iseconds)] Backup complete: $(du -sh "${ENC_FILE}" | cut -f1)"

# Optional: replicate to S3.
if [[ -n "${BACKUP_S3_BUCKET}" ]]; then
  if command -v aws >/dev/null 2>&1; then
    S3_BASE="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}"
    echo "[$(date -Iseconds)] Uploading to ${S3_BASE}/"
    aws s3 cp "${ENC_FILE}" "${S3_BASE}/$(basename "${ENC_FILE}")" --only-show-errors
    aws s3 cp "${SUM_FILE}" "${S3_BASE}/$(basename "${SUM_FILE}")" --only-show-errors
    echo "[$(date -Iseconds)] S3 upload complete"
  else
    echo "[$(date -Iseconds)] WARNING: BACKUP_S3_BUCKET set but aws CLI not installed; skipping upload" >&2
  fi
fi

# Retention: delete encrypted dumps older than RETENTION_DAYS, plus their sidecars.
find "${BACKUP_DIR}" -name "${POSTGRES_DB}-*.sql.gz.gpg" -mtime +"$((RETENTION_DAYS - 1))" -delete
find "${BACKUP_DIR}" -name "${POSTGRES_DB}-*.sql.gz.gpg.sha256" -mtime +"$((RETENTION_DAYS - 1))" -delete
# Clean up any legacy unencrypted dumps left behind by previous versions.
find "${BACKUP_DIR}" -name "${POSTGRES_DB}-*.sql.gz" -mtime +"$((RETENTION_DAYS - 1))" -delete 2>/dev/null || true
echo "[$(date -Iseconds)] Cleanup: removed backups older than ${RETENTION_DAYS} days"
