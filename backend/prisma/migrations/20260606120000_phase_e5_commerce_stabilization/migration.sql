-- Phase E.5 Commerce Stabilization Migration
-- 1. CartItem: add variant fields, drop product-only unique constraint
-- 2. OrderItem: add variant fields
-- 3. ProductVariant: no DDL change needed (relations managed by Prisma)
-- 4. User: add login lockout fields
-- 5. Order: add idempotency key

-- ── 1. CartItem ───────────────────────────────────────────────────────────────

-- Drop the old (cart_id, product_id) unique constraint so the same product
-- can appear multiple times with different variant IDs.
ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cart_id_product_id_key";

ALTER TABLE "cart_items"
  ADD COLUMN "variant_id"        UUID         REFERENCES "product_variants"("id") ON DELETE SET NULL,
  ADD COLUMN "variant_name"      VARCHAR(255),
  ADD COLUMN "variant_attributes" JSONB;

CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");

-- ── 2. OrderItem ──────────────────────────────────────────────────────────────

ALTER TABLE "order_items"
  ADD COLUMN "variant_id"        UUID         REFERENCES "product_variants"("id") ON DELETE SET NULL,
  ADD COLUMN "variant_name"      VARCHAR(255),
  ADD COLUMN "variant_attributes" JSONB;

CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- ── 3. User: login lockout ────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN "login_fail_count"   INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN "login_locked_until" TIMESTAMPTZ;

-- ── 4. Order: idempotency key ─────────────────────────────────────────────────

ALTER TABLE "orders"
  ADD COLUMN "idempotency_key" VARCHAR(255);

CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
