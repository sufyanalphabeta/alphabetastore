-- CreateEnum
CREATE TYPE "CatalogImportSourceSystem" AS ENUM ('RAKIZA', 'GENERIC_CSV');

-- CreateEnum
CREATE TYPE "CatalogImportFileFormat" AS ENUM ('CSV', 'XLS', 'XLSX');

-- CreateEnum
CREATE TYPE "CatalogImportMode" AS ENUM ('PRODUCTS_ONLY', 'PRICES_ONLY', 'PRODUCTS_AND_PRICES');

-- CreateEnum
CREATE TYPE "CatalogImportSessionStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'READY_FOR_REVIEW', 'APPROVED', 'APPLYING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CatalogImportRowStatus" AS ENUM ('NEW', 'UNCHANGED', 'PRICE_CHANGED', 'CATEGORY_CHANGED', 'CONFLICT', 'INVALID', 'APPLIED', 'SKIPPED');

-- CreateTable
CREATE TABLE "catalog_import_profiles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "source_system" "CatalogImportSourceSystem" NOT NULL,
    "file_format" "CatalogImportFileFormat" NOT NULL,
    "column_mapping" JSONB NOT NULL,
    "category_mapping" JSONB,
    "brand_mapping" JSONB,
    "source_currency" "BaseCurrency" NOT NULL DEFAULT 'LYD',
    "import_mode" "CatalogImportMode" NOT NULL DEFAULT 'PRODUCTS_AND_PRICES',
    "update_policy" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_import_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_import_sessions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "initiated_by_user_id" UUID,
    "approved_by_user_id" UUID,
    "original_filename" VARCHAR(255) NOT NULL,
    "stored_file_ref" VARCHAR(500) NOT NULL,
    "file_format" "CatalogImportFileFormat" NOT NULL,
    "file_size_bytes" INTEGER,
    "file_checksum" VARCHAR(128),
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "new_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_count" INTEGER NOT NULL DEFAULT 0,
    "changed_count" INTEGER NOT NULL DEFAULT 0,
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogImportSessionStatus" NOT NULL DEFAULT 'UPLOADED',
    "started_at" TIMESTAMPTZ(6),
    "analyzed_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "applied_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "failure_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_import_rows" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_values" JSONB NOT NULL,
    "normalized_values" JSONB,
    "matched_product_id" UUID,
    "status" "CatalogImportRowStatus" NOT NULL DEFAULT 'NEW',
    "validation_errors" JSONB,
    "detected_changes" JSONB,
    "apply_result" JSONB,
    "applied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_import_profiles_name_source_system_key"
ON "catalog_import_profiles"("name", "source_system");

CREATE INDEX "catalog_import_profiles_source_system_idx"
ON "catalog_import_profiles"("source_system");

CREATE INDEX "catalog_import_profiles_is_active_idx"
ON "catalog_import_profiles"("is_active");

CREATE INDEX "catalog_import_sessions_profile_id_idx"
ON "catalog_import_sessions"("profile_id");

CREATE INDEX "catalog_import_sessions_status_idx"
ON "catalog_import_sessions"("status");

CREATE INDEX "catalog_import_sessions_initiated_by_user_id_idx"
ON "catalog_import_sessions"("initiated_by_user_id");

CREATE UNIQUE INDEX "catalog_import_rows_session_id_row_number_key"
ON "catalog_import_rows"("session_id", "row_number");

CREATE INDEX "catalog_import_rows_session_id_status_idx"
ON "catalog_import_rows"("session_id", "status");

CREATE INDEX "catalog_import_rows_matched_product_id_idx"
ON "catalog_import_rows"("matched_product_id");

-- AddForeignKey
ALTER TABLE "catalog_import_sessions"
ADD CONSTRAINT "catalog_import_sessions_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "catalog_import_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "catalog_import_sessions"
ADD CONSTRAINT "catalog_import_sessions_initiated_by_user_id_fkey"
FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "catalog_import_sessions"
ADD CONSTRAINT "catalog_import_sessions_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "catalog_import_rows"
ADD CONSTRAINT "catalog_import_rows_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "catalog_import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_import_rows"
ADD CONSTRAINT "catalog_import_rows_matched_product_id_fkey"
FOREIGN KEY ("matched_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
