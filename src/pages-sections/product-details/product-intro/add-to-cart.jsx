"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

import useCart from "hooks/useCart";
import { purchaseQuantityErrorMessage } from "utils/purchase-quantity";

export default function AddToCart({ product, selectedVariant }) {
  const { id } = product;
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const { addItem, state } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const effectiveAvailability = selectedVariant || product;
  const effectiveStock = Number(effectiveAvailability.availableStock ?? effectiveAvailability.stockQty ?? 0);
  const configuredLimit = effectiveAvailability.maxPurchaseQty == null
    ? null
    : Number(effectiveAvailability.maxPurchaseQty);
  const productCartItems = state.cart.filter(item => item.productId === id);
  const productQuantityInCart = productCartItems.reduce((sum, item) => sum + item.qty, 0);
  const selectedLineQuantity = productCartItems
    .filter(item => (item.variantId ?? null) === (selectedVariant?.id ?? null))
    .reduce((sum, item) => sum + item.qty, 0);
  const remainingStock = Math.max(0, effectiveStock - selectedLineQuantity);
  const remainingConfiguredLimit = configuredLimit == null
    ? remainingStock
    : Math.max(0, configuredLimit - productQuantityInCart);
  const effectiveMaxQuantity = Math.max(0, Math.min(remainingStock, remainingConfiguredLimit));
  const requiresVariantSelection = product.hasVariants && !selectedVariant;
  const isOutOfStock = effectiveStock <= 0;
  const reachedCartLimit = !isOutOfStock && effectiveMaxQuantity <= 0;

  useEffect(() => {
    setQuantity(effectiveMaxQuantity > 0 ? 1 : 0);
    setErrorMessage("");
  }, [effectiveMaxQuantity, selectedVariant?.id]);

  const handleAddToCart = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      await addItem(id, quantity, selectedVariant?.id ?? null);
      router.push("/mini-cart", { scroll: false });
    } catch (error) {
      setErrorMessage(purchaseQuantityErrorMessage(error, "تعذر إضافة المنتج إلى السلة."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={1.25}>
      {effectiveMaxQuantity > 0 && !requiresVariantSelection ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" color="text.secondary">الكمية</Typography>
          <IconButton
            size="small"
            onClick={() => setQuantity(value => Math.max(1, value - 1))}
            disabled={quantity <= 1}
            aria-label="تقليل الكمية"
          >
            <RemoveIcon />
          </IconButton>
          <Typography minWidth={28} textAlign="center" fontWeight={700}>{quantity}</Typography>
          <IconButton
            size="small"
            onClick={() => setQuantity(value => Math.min(effectiveMaxQuantity, value + 1))}
            disabled={quantity >= effectiveMaxQuantity}
            aria-label="زيادة الكمية"
          >
            <AddIcon />
          </IconButton>
        </Stack>
      ) : null}

      {configuredLimit != null && configuredLimit <= effectiveStock ? (
        <Typography variant="body2" color="text.secondary">
          الحد الأقصى للشراء: {configuredLimit}
        </Typography>
      ) : null}
      {requiresVariantSelection ? (
        <Typography variant="body2" color="warning.main">اختر مواصفات المنتج أولًا.</Typography>
      ) : null}
      {errorMessage ? <Typography variant="body2" color="error.main">{errorMessage}</Typography> : null}

      <Button
        color="primary"
        variant="contained"
        loading={isLoading}
        onClick={handleAddToCart}
        disabled={isOutOfStock || reachedCartLimit || requiresVariantSelection}
        sx={{ px: "1.75rem", minHeight: 48, width: "100%", fontWeight: 700 }}
      >
        {isOutOfStock
          ? "غير متوفر"
          : requiresVariantSelection
            ? "اختر المواصفات"
            : reachedCartLimit
              ? "بلغت الحد المسموح في السلة"
              : "أضف إلى السلة"}
      </Button>
    </Stack>
  );
}
