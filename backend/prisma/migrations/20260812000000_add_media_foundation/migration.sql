-- M1 media foundation. ProductImage remains intact for compatibility.
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "MediaProcessingStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
CREATE TYPE "ProductMediaRole" AS ENUM ('PRIMARY', 'GALLERY', 'VIDEO');

CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "media_type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "original_filename" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "original_mime_type" VARCHAR(120) NOT NULL,
    "original_size_bytes" INTEGER NOT NULL,
    "original_width" INTEGER,
    "original_height" INTEGER,
    "checksum_sha256" CHAR(64),
    "aspect_ratio" DECIMAL(10,4),
    "alt_text" VARCHAR(255),
    "title" VARCHAR(160),
    "caption" TEXT,
    "processing_status" "MediaProcessingStatus" NOT NULL DEFAULT 'PROCESSING',
    "variants" JSONB,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_media" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "role" "ProductMediaRole" NOT NULL DEFAULT 'GALLERY',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_assets_checksum_sha256_key" ON "media_assets"("checksum_sha256");
CREATE INDEX "media_assets_media_type_idx" ON "media_assets"("media_type");
CREATE INDEX "media_assets_processing_status_idx" ON "media_assets"("processing_status");
CREATE INDEX "media_assets_created_at_idx" ON "media_assets"("created_at");
CREATE INDEX "media_assets_uploaded_by_id_idx" ON "media_assets"("uploaded_by_id");
CREATE UNIQUE INDEX "product_media_product_id_media_asset_id_key" ON "product_media"("product_id", "media_asset_id");
CREATE UNIQUE INDEX "product_media_product_id_sort_order_key" ON "product_media"("product_id", "sort_order");
CREATE UNIQUE INDEX "product_media_one_primary_per_product_key" ON "product_media"("product_id") WHERE "role" = 'PRIMARY';
CREATE INDEX "product_media_product_id_role_idx" ON "product_media"("product_id", "role");
CREATE INDEX "product_media_media_asset_id_idx" ON "product_media"("media_asset_id");

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
