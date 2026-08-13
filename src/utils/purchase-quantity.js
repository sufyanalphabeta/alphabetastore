export function purchaseQuantityErrorMessage(error, fallback = "تعذر تحديث الكمية.") {
  const code = error?.code;
  if (code === "INVALID_QUANTITY") return "يجب أن تكون الكمية عددًا صحيحًا أكبر من صفر.";
  if (code === "OUT_OF_STOCK") return "هذا المنتج غير متوفر حاليًا.";
  if (code === "INSUFFICIENT_STOCK" || code === "CART_STOCK_CHANGED") {
    return "الكمية المطلوبة لم تعد متوفرة. تم تحديث السلة حسب المخزون الحالي.";
  }
  if (code === "MAX_PURCHASE_QUANTITY_EXCEEDED") {
    return "تجاوزت الحد الأقصى المسموح لشراء هذا المنتج.";
  }
  if (code === "PRODUCT_VARIANT_REQUIRED") {
    return "اختر مواصفات المنتج المطلوبة قبل إضافته إلى السلة.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
