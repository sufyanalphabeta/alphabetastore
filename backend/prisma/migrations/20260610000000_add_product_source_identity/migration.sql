-- CreateTable
CREATE TABLE "product_source_identities" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "source_system" VARCHAR(60) NOT NULL,
    "external_id" VARCHAR(160) NOT NULL,
    "source_barcode" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_source_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_source_identities_source_system_external_id_key"
ON "product_source_identities"("source_system", "external_id");

-- CreateIndex
CREATE INDEX "product_source_identities_product_id_idx"
ON "product_source_identities"("product_id");

-- CreateIndex
CREATE INDEX "product_source_identities_source_system_source_barcode_idx"
ON "product_source_identities"("source_system", "source_barcode");

-- AddForeignKey
ALTER TABLE "product_source_identities"
ADD CONSTRAINT "product_source_identities_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
