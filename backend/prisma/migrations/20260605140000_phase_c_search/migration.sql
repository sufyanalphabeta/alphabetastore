-- Phase C — Search & Discovery
-- 1. search_terms table for analytics (popular searches)
CREATE TABLE IF NOT EXISTS "search_terms" (
  "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
  "term"       VARCHAR(255)  NOT NULL,
  "hit_count"  INTEGER       NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_terms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "search_terms_term_key" ON "search_terms" ("term");
CREATE INDEX IF NOT EXISTS "search_terms_hit_count_idx" ON "search_terms" ("hit_count" DESC);
CREATE INDEX IF NOT EXISTS "search_terms_updated_at_idx" ON "search_terms" ("updated_at" DESC);

-- 2. GIN index on products for full-text search (tsvector) — supports typo-tolerant ranking
-- Using pg_trgm for trigram similarity (typo tolerance + partial match)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "products_name_trgm_idx"  ON "products" USING gin ("name"  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_brand_trgm_idx" ON "products" USING gin ("brand" gin_trgm_ops) WHERE "brand" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "products_sku_trgm_idx"   ON "products" USING gin ("sku"   gin_trgm_ops) WHERE "sku"   IS NOT NULL;

-- 3. Composite index for availability (inStock) filter
CREATE INDEX IF NOT EXISTS "products_stock_status_idx" ON "products" ("stock_qty", "status");
