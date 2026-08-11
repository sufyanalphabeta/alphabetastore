ALTER TABLE "search_terms"
ADD COLUMN IF NOT EXISTS "last_searched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "search_terms"
SET "last_searched_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
WHERE "last_searched_at" IS NULL;

CREATE INDEX IF NOT EXISTS "search_terms_last_searched_at_idx"
ON "search_terms" ("last_searched_at");