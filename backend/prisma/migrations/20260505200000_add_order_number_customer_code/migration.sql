-- AlterTable: add customerCode to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_code" VARCHAR(8);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_customer_code_key" ON "users"("customer_code");

-- AlterTable: add orderNumber to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" VARCHAR(40);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_key" ON "orders"("order_number");
