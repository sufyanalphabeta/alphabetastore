ALTER TABLE "products"
ADD COLUMN "max_purchase_qty" INTEGER;

ALTER TABLE "products"
ADD CONSTRAINT "products_max_purchase_qty_check"
CHECK ("max_purchase_qty" IS NULL OR "max_purchase_qty" >= 1);
