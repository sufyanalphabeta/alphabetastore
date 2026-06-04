-- Launch hardening: password reset, composite indexes, decimal unification

-- 1. Password reset tokens
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Composite indexes
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");
CREATE INDEX "products_category_id_status_idx" ON "products"("category_id", "status");
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- 3. Decimal precision unification (widen to 12,4 — non-destructive)
ALTER TABLE "cart_items" ALTER COLUMN "unit_price" TYPE DECIMAL(12, 4);
ALTER TABLE "orders" ALTER COLUMN "total_amount" TYPE DECIMAL(12, 4);
ALTER TABLE "payment_transactions" ALTER COLUMN "amount" TYPE DECIMAL(12, 4);
ALTER TABLE "services" ALTER COLUMN "base_price" TYPE DECIMAL(12, 4);
