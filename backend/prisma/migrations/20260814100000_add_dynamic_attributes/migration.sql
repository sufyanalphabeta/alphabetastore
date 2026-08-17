CREATE TYPE "AttributeDataType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT');

CREATE TABLE "attribute_definitions" (
  "id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "name_en" VARCHAR(160),
  "description" TEXT,
  "data_type" "AttributeDataType" NOT NULL,
  "unit" VARCHAR(40),
  "allowed_values" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attribute_profiles" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attribute_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attribute_profile_items" (
  "id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "attribute_definition_id" UUID NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "filterable" BOOLEAN NOT NULL DEFAULT false,
  "comparable" BOOLEAN NOT NULL DEFAULT false,
  "visible_on_product" BOOLEAN NOT NULL DEFAULT true,
  "visible_in_summary" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "attribute_profile_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_attribute_values" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "attribute_definition_id" UUID NOT NULL,
  "text_value" TEXT,
  "number_value" DECIMAL(20,6),
  "boolean_value" BOOLEAN,
  "json_value" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_attribute_values_one_value_check" CHECK (
    (("text_value" IS NOT NULL)::int + ("number_value" IS NOT NULL)::int +
     ("boolean_value" IS NOT NULL)::int + ("json_value" IS NOT NULL)::int) = 1
  )
);

ALTER TABLE "categories" ADD COLUMN "attribute_profile_id" UUID;

CREATE UNIQUE INDEX "attribute_definitions_code_key" ON "attribute_definitions"("code");
CREATE INDEX "attribute_definitions_is_active_idx" ON "attribute_definitions"("is_active");
CREATE INDEX "attribute_profiles_is_active_idx" ON "attribute_profiles"("is_active");
CREATE UNIQUE INDEX "attribute_profile_items_profile_id_attribute_definition_id_key" ON "attribute_profile_items"("profile_id", "attribute_definition_id");
CREATE INDEX "attribute_profile_items_profile_id_sort_order_idx" ON "attribute_profile_items"("profile_id", "sort_order");
CREATE INDEX "attribute_profile_items_attribute_definition_id_idx" ON "attribute_profile_items"("attribute_definition_id");
CREATE UNIQUE INDEX "product_attribute_values_product_id_attribute_definition_id_key" ON "product_attribute_values"("product_id", "attribute_definition_id");
CREATE INDEX "product_attribute_values_product_id_idx" ON "product_attribute_values"("product_id");
CREATE INDEX "product_attribute_values_attribute_definition_id_text_value_idx" ON "product_attribute_values"("attribute_definition_id", "text_value");
CREATE INDEX "product_attribute_values_attribute_definition_id_number_value_idx" ON "product_attribute_values"("attribute_definition_id", "number_value");
CREATE INDEX "product_attribute_values_attribute_definition_id_boolean_value_idx" ON "product_attribute_values"("attribute_definition_id", "boolean_value");
CREATE INDEX "categories_attribute_profile_id_idx" ON "categories"("attribute_profile_id");

ALTER TABLE "categories" ADD CONSTRAINT "categories_attribute_profile_id_fkey"
  FOREIGN KEY ("attribute_profile_id") REFERENCES "attribute_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attribute_profile_items" ADD CONSTRAINT "attribute_profile_items_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "attribute_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attribute_profile_items" ADD CONSTRAINT "attribute_profile_items_attribute_definition_id_fkey"
  FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_definition_id_fkey"
  FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
