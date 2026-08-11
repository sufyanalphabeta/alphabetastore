-- Optional product-level USD to LYD rate. NULL means use the global setting.
ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "exchange_rate_override" DECIMAL(12, 6);
