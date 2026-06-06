#!/bin/sh
# Bootstrap script â€” runs on every container start.
# All steps are idempotent (upsert / migrate deploy) so re-runs are safe.

set -e

echo "[bootstrap] Running database migrations..."
node node_modules/.bin/prisma migrate deploy

# Seed is non-fatal: if it fails the app can still start (migrations already ran).
echo "[bootstrap] Seeding reference data (payment methods, system settings, admin)..."
node dist/prisma/seed.js || echo "[bootstrap] WARNING: seed script exited non-zero â€” check logs above."

# create-admin is non-fatal: may be a no-op when ADMIN_EMAIL/ADMIN_PASSWORD are unset.
echo "[bootstrap] Ensuring admin user exists..."
node dist/prisma/create-admin.js || echo "[bootstrap] WARNING: create-admin script exited non-zero â€” check logs above."

echo "[bootstrap] Bootstrap complete. Starting application..."
exec node dist/src/main.js
