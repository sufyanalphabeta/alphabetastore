-- Phase A sign-off: expand Brand with banner image and SEO meta fields.
ALTER TABLE "brands"
  ADD COLUMN IF NOT EXISTS "banner_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "meta_title" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "meta_desc"  VARCHAR(320);
