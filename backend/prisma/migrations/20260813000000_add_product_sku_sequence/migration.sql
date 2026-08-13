-- Internal AlfaBeta Product SKU sequence. Values are never recycled.
CREATE SEQUENCE "product_sku_seq"
AS BIGINT MINVALUE 1 START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Backfill missing values in a deterministic order. Existing non-empty SKUs
-- are never changed. Collision checks allow legacy/custom AB-* values without
-- deriving the next number from application data.
DO $$
DECLARE
  product_row RECORD;
  sequence_value BIGINT;
  candidate TEXT;
BEGIN
  FOR product_row IN
    SELECT "id" FROM "products"
    WHERE "sku" IS NULL OR btrim("sku") = ''
    ORDER BY "created_at", "id"
  LOOP
    LOOP
      sequence_value := nextval('product_sku_seq');
      candidate := 'AB-' || lpad(sequence_value::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "products" WHERE "sku" = candidate);
    END LOOP;

    UPDATE "products" SET "sku" = candidate
    WHERE "id" = product_row."id" AND ("sku" IS NULL OR btrim("sku") = '');
  END LOOP;
END $$;
