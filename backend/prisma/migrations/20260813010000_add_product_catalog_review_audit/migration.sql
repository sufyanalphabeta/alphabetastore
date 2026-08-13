ALTER TABLE "products"
ADD COLUMN "catalog_reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN "catalog_reviewed_by_user_id" UUID;

CREATE INDEX "products_catalog_reviewed_at_idx" ON "products"("catalog_reviewed_at");
CREATE INDEX "products_catalog_reviewed_by_user_id_idx" ON "products"("catalog_reviewed_by_user_id");

ALTER TABLE "products"
ADD CONSTRAINT "products_catalog_reviewed_by_user_id_fkey"
FOREIGN KEY ("catalog_reviewed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
