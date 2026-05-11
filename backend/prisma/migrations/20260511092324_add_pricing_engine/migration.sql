-- CreateEnum
CREATE TYPE "BaseCurrency" AS ENUM ('USD', 'LYD');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "base_currency" "BaseCurrency" NOT NULL DEFAULT 'LYD',
ADD COLUMN     "compare_price" DECIMAL(12,4),
ADD COLUMN     "exchange_rate_used" DECIMAL(12,6),
ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "base_currency" "BaseCurrency" NOT NULL DEFAULT 'LYD',
ADD COLUMN     "compare_price" DECIMAL(12,4),
ADD COLUMN     "discount_end_at" TIMESTAMPTZ(6),
ADD COLUMN     "discount_start_at" TIMESTAMPTZ(6),
ADD COLUMN     "discount_type" "DiscountType",
ADD COLUMN     "discount_value" DECIMAL(12,4),
ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,4);

-- CreateTable
CREATE TABLE "price_history" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "old_base_price" DECIMAL(12,4) NOT NULL,
    "new_base_price" DECIMAL(12,4) NOT NULL,
    "old_compare_price" DECIMAL(12,4),
    "new_compare_price" DECIMAL(12,4),
    "old_currency" "BaseCurrency" NOT NULL,
    "new_currency" "BaseCurrency" NOT NULL,
    "exchange_rate_used" DECIMAL(12,6) NOT NULL,
    "change_reason" VARCHAR(255),
    "changed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_history_product_id_idx" ON "price_history"("product_id");

-- CreateIndex
CREATE INDEX "price_history_changed_by_user_id_idx" ON "price_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "price_history_created_at_idx" ON "price_history"("created_at");

-- CreateIndex
CREATE INDEX "products_base_currency_idx" ON "products"("base_currency");

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
