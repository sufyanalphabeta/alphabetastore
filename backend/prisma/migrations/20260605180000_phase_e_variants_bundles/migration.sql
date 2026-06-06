-- Phase E: Product Variants, Bundles, and Cross-sell / Merchandising
-- Migration: 20260605180000_phase_e_variants_bundles

-- 1. Enum: ProductRelationType
CREATE TYPE "ProductRelationType" AS ENUM (
  'ACCESSORY',
  'FREQUENTLY_BOUGHT_TOGETHER',
  'RECOMMENDED',
  'COMPATIBLE'
);

-- 2. has_variants flag on products
ALTER TABLE "products"
  ADD COLUMN "has_variants" BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. ProductVariant table
CREATE TABLE "product_variants" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id"    UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sku"           VARCHAR(120) UNIQUE,
  "name"          VARCHAR(160),
  "attributes"    JSONB NOT NULL DEFAULT '{}',
  "price"         DECIMAL(12,4) NOT NULL,
  "compare_price" DECIMAL(12,4),
  "stock_qty"     INTEGER NOT NULL,
  "image_url"     VARCHAR(500),
  "is_default"    BOOLEAN NOT NULL DEFAULT FALSE,
  "sort_order"    INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");
CREATE INDEX "product_variants_sku_idx"        ON "product_variants"("sku");

-- 4. Bundles table
CREATE TABLE "bundles" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"         VARCHAR(160) NOT NULL,
  "slug"         VARCHAR(180) NOT NULL UNIQUE,
  "description"  TEXT,
  "bundle_price" DECIMAL(12,4),
  "image_url"    VARCHAR(500),
  "is_active"    BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "bundles_is_active_idx"   ON "bundles"("is_active");
CREATE INDEX "bundles_sort_order_idx"  ON "bundles"("sort_order");

-- 5. BundleItem table
CREATE TABLE "bundle_items" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "bundle_id"  UUID NOT NULL REFERENCES "bundles"("id") ON DELETE CASCADE,
  "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "quantity"   INTEGER NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "bundle_items_bundle_id_product_id_key" UNIQUE ("bundle_id", "product_id")
);

CREATE INDEX "bundle_items_bundle_id_idx"  ON "bundle_items"("bundle_id");
CREATE INDEX "bundle_items_product_id_idx" ON "bundle_items"("product_id");

-- 6. ProductRelation table
CREATE TABLE "product_relations" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id"     UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "target_id"     UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "relation_type" "ProductRelationType" NOT NULL,
  "sort_order"    INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "product_relations_source_target_type_key" UNIQUE ("source_id", "target_id", "relation_type")
);

CREATE INDEX "product_relations_source_type_idx" ON "product_relations"("source_id", "relation_type");
CREATE INDEX "product_relations_target_idx"       ON "product_relations"("target_id");
