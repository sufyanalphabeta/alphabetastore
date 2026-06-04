-- Phase A — Catalog experience: brands, homepage blocks, recently-viewed,
-- notifications, themes, and category/product merchandising flags.

-- New enums
CREATE TYPE "HomepageBlockType" AS ENUM (
  'FEATURED_CATEGORIES',
  'NEW_ARRIVALS',
  'BEST_SELLERS',
  'PROMOTIONS',
  'RECENTLY_ADDED',
  'FEATURED_BRANDS',
  'HERO_BANNER',
  'CUSTOM_PRODUCTS'
);

CREATE TYPE "NotificationType" AS ENUM (
  'ORDER_UPDATE',
  'PAYMENT_UPDATE',
  'TICKET_UPDATE',
  'SYSTEM'
);

-- categories: merchandising flags + hero
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "is_featured"  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "image_url"    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "description"  TEXT;

CREATE INDEX IF NOT EXISTS "categories_is_featured_idx" ON "categories" ("is_featured");

-- brands
CREATE TABLE IF NOT EXISTS "brands" (
  "id"          UUID         NOT NULL,
  "name"        VARCHAR(120) NOT NULL,
  "slug"        VARCHAR(160) NOT NULL,
  "logo_url"    VARCHAR(500),
  "description" TEXT,
  "is_visible"  BOOLEAN      NOT NULL DEFAULT true,
  "is_featured" BOOLEAN      NOT NULL DEFAULT false,
  "sort_order"  INTEGER      NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "brands_slug_key" ON "brands" ("slug");
CREATE INDEX IF NOT EXISTS "brands_is_visible_idx"  ON "brands" ("is_visible");
CREATE INDEX IF NOT EXISTS "brands_is_featured_idx" ON "brands" ("is_featured");
CREATE INDEX IF NOT EXISTS "brands_sort_order_idx"  ON "brands" ("sort_order");

-- products: brand FK + highlights + merchandising counters
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "brand_id"    UUID,
  ADD COLUMN IF NOT EXISTS "highlights"  JSONB,
  ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "view_count"  INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sales_count" INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_brand_id_fkey'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_brand_id_fkey"
      FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "products_brand_id_idx"    ON "products" ("brand_id");
CREATE INDEX IF NOT EXISTS "products_is_featured_idx" ON "products" ("is_featured");
CREATE INDEX IF NOT EXISTS "products_sales_count_idx" ON "products" ("sales_count");
CREATE INDEX IF NOT EXISTS "products_view_count_idx"  ON "products" ("view_count");

-- homepage_blocks
CREATE TABLE IF NOT EXISTS "homepage_blocks" (
  "id"         UUID                 NOT NULL,
  "type"       "HomepageBlockType"  NOT NULL,
  "title"      VARCHAR(160)         NOT NULL,
  "subtitle"   VARCHAR(255),
  "config"     JSONB,
  "is_active"  BOOLEAN              NOT NULL DEFAULT true,
  "sort_order" INTEGER              NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "homepage_blocks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "homepage_blocks_is_active_idx"  ON "homepage_blocks" ("is_active");
CREATE INDEX IF NOT EXISTS "homepage_blocks_sort_order_idx" ON "homepage_blocks" ("sort_order");
CREATE INDEX IF NOT EXISTS "homepage_blocks_type_idx"       ON "homepage_blocks" ("type");

-- recently_viewed_items
CREATE TABLE IF NOT EXISTS "recently_viewed_items" (
  "id"         UUID            NOT NULL,
  "user_id"    UUID,
  "session_id" VARCHAR(191),
  "product_id" UUID            NOT NULL,
  "viewed_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recently_viewed_items_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recently_viewed_items_product_id_fkey'
  ) THEN
    ALTER TABLE "recently_viewed_items"
      ADD CONSTRAINT "recently_viewed_items_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "recently_viewed_items_user_id_product_id_key"
  ON "recently_viewed_items" ("user_id", "product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recently_viewed_items_session_id_product_id_key"
  ON "recently_viewed_items" ("session_id", "product_id");
CREATE INDEX IF NOT EXISTS "recently_viewed_items_user_id_viewed_at_idx"
  ON "recently_viewed_items" ("user_id", "viewed_at");
CREATE INDEX IF NOT EXISTS "recently_viewed_items_session_id_viewed_at_idx"
  ON "recently_viewed_items" ("session_id", "viewed_at");

-- notifications
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         UUID                NOT NULL,
  "user_id"    UUID                NOT NULL,
  "type"       "NotificationType"  NOT NULL,
  "title"      VARCHAR(255)        NOT NULL,
  "body"       TEXT,
  "link"       VARCHAR(500),
  "metadata"   JSONB,
  "read_at"    TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx"    ON "notifications" ("user_id", "read_at");

-- themes
CREATE TABLE IF NOT EXISTS "themes" (
  "id"          UUID            NOT NULL,
  "key"         VARCHAR(60)     NOT NULL,
  "name"        VARCHAR(120)    NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN         NOT NULL DEFAULT false,
  "config"      JSONB           NOT NULL,
  "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "themes_key_key"      ON "themes" ("key");
CREATE INDEX IF NOT EXISTS "themes_is_active_idx" ON "themes" ("is_active");
