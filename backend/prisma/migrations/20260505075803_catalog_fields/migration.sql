-- AlterTable: add icon, is_visible, sort_order to categories
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(120);
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "is_visible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "categories_is_visible_idx" ON "categories"("is_visible");
CREATE INDEX IF NOT EXISTS "categories_sort_order_idx" ON "categories"("sort_order");

-- AlterTable: add brand, sku, specs to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" VARCHAR(120);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" VARCHAR(120);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "specs" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "products_brand_idx" ON "products"("brand");
CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products"("sku");
