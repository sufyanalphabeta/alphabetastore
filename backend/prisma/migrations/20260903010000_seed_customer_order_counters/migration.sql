-- Continue the per-customer sequence after existing registered-customer orders.
INSERT INTO "customer_order_counters" ("user_id", "next_value", "updated_at")
SELECT "user_id", COUNT(*)::INTEGER + 1, CURRENT_TIMESTAMP
FROM "orders"
WHERE "user_id" IS NOT NULL
GROUP BY "user_id"
ON CONFLICT ("user_id") DO NOTHING;
