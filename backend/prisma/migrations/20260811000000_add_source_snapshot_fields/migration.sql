ALTER TABLE "product_source_identities"
  ADD COLUMN "last_imported_price" DECIMAL(12,4),
  ADD COLUMN "last_imported_name" VARCHAR(160),
  ADD COLUMN "last_imported_source_category" VARCHAR(160),
  ADD COLUMN "last_imported_category_id" UUID,
  ADD COLUMN "last_imported_at" TIMESTAMPTZ(6);
