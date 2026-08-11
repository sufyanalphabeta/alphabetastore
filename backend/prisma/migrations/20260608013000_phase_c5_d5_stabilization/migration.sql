-- Phase C.5 + D.5 stabilization
-- Add recency tracking for popular searches.

ALTER TABLE "search_terms"
ADD COLUMN IF NOT EXISTS "last_searched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "search_terms_last_searched_at_idx"
ON "search_terms"("last_searched_at");

-- Backfill existing rows to avoid stale null values if column existed in a partial state.
UPDATE "search_terms"
SET "last_searched_at" = COALESCE("last_searched_at", "updated_at", "created_at");
