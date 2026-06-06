-- Phase D — Customer Trust: Ratings, Reviews, Q&A

-- 1. Add denormalized rating columns to products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "rating_avg"   DECIMAL(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rating_count" INTEGER      NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "products_rating_avg_idx" ON "products" ("rating_avg" DESC);

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "QnAStatus" AS ENUM ('PENDING', 'ANSWERED', 'HIDDEN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. reviews table
CREATE TABLE IF NOT EXISTS "reviews" (
  "id"                   UUID          NOT NULL DEFAULT gen_random_uuid(),
  "product_id"           UUID          NOT NULL,
  "user_id"              UUID          NOT NULL,
  "order_id"             UUID,
  "rating"               INTEGER       NOT NULL,
  "title"                VARCHAR(160),
  "comment"              TEXT,
  "status"               "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "is_verified_purchase" BOOLEAN       NOT NULL DEFAULT false,
  "helpful_count"        INTEGER       NOT NULL DEFAULT 0,
  "moderator_note"       TEXT,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_product_user_unique" UNIQUE ("product_id", "user_id"),
  CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5),
  CONSTRAINT "reviews_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "reviews_user_fk"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "reviews_product_status_idx"     ON "reviews" ("product_id", "status");
CREATE INDEX IF NOT EXISTS "reviews_user_idx"               ON "reviews" ("user_id");
CREATE INDEX IF NOT EXISTS "reviews_status_idx"             ON "reviews" ("status");
CREATE INDEX IF NOT EXISTS "reviews_rating_idx"             ON "reviews" ("rating");
CREATE INDEX IF NOT EXISTS "reviews_verified_idx"           ON "reviews" ("is_verified_purchase");
CREATE INDEX IF NOT EXISTS "reviews_created_at_idx"         ON "reviews" ("created_at" DESC);

-- 4. review_images table
CREATE TABLE IF NOT EXISTS "review_images" (
  "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
  "review_id"  UUID          NOT NULL,
  "image_url"  VARCHAR(500)  NOT NULL,
  "sort_order" INTEGER       NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_images_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "review_images_review_fk" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "review_images_review_idx" ON "review_images" ("review_id");

-- 5. product_qna table
CREATE TABLE IF NOT EXISTS "product_qna" (
  "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "product_id"   UUID          NOT NULL,
  "user_id"      UUID          NOT NULL,
  "question"     TEXT          NOT NULL,
  "answer"       TEXT,
  "answered_at"  TIMESTAMPTZ(6),
  "status"       "QnAStatus"   NOT NULL DEFAULT 'PENDING',
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_qna_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "product_qna_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "product_qna_user_fk"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_qna_product_status_idx" ON "product_qna" ("product_id", "status");
CREATE INDEX IF NOT EXISTS "product_qna_user_idx"           ON "product_qna" ("user_id");
CREATE INDEX IF NOT EXISTS "product_qna_status_idx"         ON "product_qna" ("status");
CREATE INDEX IF NOT EXISTS "product_qna_created_at_idx"     ON "product_qna" ("created_at" DESC);
