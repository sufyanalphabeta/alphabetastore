-- Keep category timestamps consistent with the Prisma schema.
ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
