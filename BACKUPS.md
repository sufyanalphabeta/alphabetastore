# Database backups

The production stack runs a `db-backup` sidecar that takes a daily encrypted
PostgreSQL dump. This document covers the format, where to find dumps, how to
manage the encryption key, optional offsite (S3) replication, and how to restore.

## What gets produced

Every 24h the sidecar runs `scripts/backup-db.sh`, which:

1. `pg_dump` of `$POSTGRES_DB` piped through `gzip`.
2. Encrypts the gzipped stream with `gpg --symmetric --cipher-algo AES256`
   using `$BACKUP_ENCRYPTION_KEY` as the passphrase.
3. Writes a sidecar `.sha256` for integrity checks.
4. Removes the plaintext gzip — only the encrypted dump persists on disk.
5. Optionally uploads both files to S3 if `BACKUP_S3_BUCKET` is set.
6. Prunes encrypted dumps older than `BACKUP_RETENTION_DAYS` (default 7).

Output filename pattern (in `./backups/` on the host, mounted to `/backups`
inside the sidecar):

```
${POSTGRES_DB}-YYYYMMDD_HHMMSS.sql.gz.gpg
${POSTGRES_DB}-YYYYMMDD_HHMMSS.sql.gz.gpg.sha256
```

## Required environment variables

Set these in your repo-root `.env` (or wherever you supply secrets to
`docker compose -f docker-compose.prod.yml`):

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | DB credentials |
| `BACKUP_ENCRYPTION_KEY` | **Required.** Long random passphrase (≥ 32 chars). |
| `BACKUP_RETENTION_DAYS` | Optional, default `7`. |
| `BACKUP_S3_BUCKET` | Optional. If set, dumps are uploaded to S3. |
| `BACKUP_S3_PREFIX` | Optional, default `alphabeta-postgres`. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_DEFAULT_REGION` | Required if S3 is enabled. |

Generate a strong key once:

```bash
openssl rand -base64 48
```

**Store the key in your secrets manager (Vault / AWS Secrets Manager / 1Password).
Without it, the backups are unrecoverable.**

## Verifying a backup

```bash
cd backups
sha256sum -c alphabeta-20260101_020000.sql.gz.gpg.sha256
```

## Restoring

Use `scripts/restore-db.sh`. It verifies the `.sha256` sidecar (if present),
prompts for confirmation (you must retype the database name), then decrypts
and pipes the dump into `psql`.

```bash
BACKUP_ENCRYPTION_KEY='...' \
POSTGRES_USER=alphabeta \
POSTGRES_DB=alphabeta \
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
PGPASSWORD='...' \
./scripts/restore-db.sh ./backups/alphabeta-20260101_020000.sql.gz.gpg
```

To restore inside the running compose stack:

```bash
docker compose -f docker-compose.prod.yml exec db sh -lc '
  apk add --no-cache gnupg >/dev/null 2>&1 || true
'
docker compose -f docker-compose.prod.yml cp \
  backups/alphabeta-20260101_020000.sql.gz.gpg db:/tmp/dump.gpg
docker compose -f docker-compose.prod.yml cp \
  scripts/restore-db.sh db:/tmp/restore-db.sh
docker compose -f docker-compose.prod.yml exec \
  -e BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  db sh /tmp/restore-db.sh /tmp/dump.gpg
```

## Manual ad-hoc backup

```bash
docker compose -f docker-compose.prod.yml exec \
  -e BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
  db-backup /usr/local/bin/backup-db.sh
```

## Operational checks

- Confirm the sidecar is running: `docker compose -f docker-compose.prod.yml ps db-backup`
- Tail logs: `docker compose -f docker-compose.prod.yml logs -f db-backup`
- Rotate `BACKUP_ENCRYPTION_KEY` annually. Old dumps remain readable with the
  key that was active when they were produced — keep retired keys archived as
  long as you keep the dumps.
- Test the restore procedure on staging at least once a quarter.
