-- Human-facing customer codes are allocated by PostgreSQL and never reused.
CREATE SEQUENCE "customer_code_seq"
  AS BIGINT MINVALUE 1 START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Start after any existing numeric codes while preserving legacy codes.
DO $$
DECLARE
  current_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(CASE WHEN btrim("customer_code") ~ '^[0-9]+$'
                           THEN btrim("customer_code")::BIGINT ELSE 0 END), 0)
    INTO current_max
    FROM "users";
  IF current_max > 0 THEN
    PERFORM setval('customer_code_seq', current_max, true);
  ELSE
    PERFORM setval('customer_code_seq', 1, false);
  END IF;
END $$;

-- Backfill only missing customer codes in a deterministic order.
DO $$
DECLARE
  customer_row RECORD;
  candidate TEXT;
BEGIN
  FOR customer_row IN
    SELECT "id" FROM "users"
    WHERE "customer_code" IS NULL OR btrim("customer_code") = ''
    ORDER BY "created_at", "id"
  LOOP
    LOOP
      candidate := lpad(nextval('customer_code_seq')::TEXT, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "users" WHERE "customer_code" = candidate);
    END LOOP;
    UPDATE "users"
      SET "customer_code" = candidate
      WHERE "id" = customer_row."id"
        AND ("customer_code" IS NULL OR btrim("customer_code") = '');
  END LOOP;
END $$;

CREATE TABLE "customer_order_counters" (
  "user_id" UUID NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_order_counters_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "customer_order_counters_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
