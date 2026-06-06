"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";

// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";

// ================================================================
// Props:
//   product       — full product object
//   selectedVariant — currently selected ProductVariant | null
// ================================================================

export default function AddToCart({ product, selectedVariant }) {
  const { id, slug, title, thumbnail } = product;
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const { dispatch } = useCart();

  // Effective price and stock come from the variant when one is selected.
  const effectivePrice = selectedVariant
    ? Number(selectedVariant.price)
    : Number(product.price ?? 0);
  const effectiveStock = selectedVariant
    ? (selectedVariant.stockQty ?? 0)
    : (product.stockQty ?? 0);

  const isOutOfStock = effectiveStock <= 0;

  const handleAddToCart = async () => {
    setLoading(true);
    try {
      await dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: {
          id,
          slug,
          price: effectivePrice,
          title,
          thumbnail,
          qty: 1,
          // Pass variant context so CartContext can call addItem with variantId
          variantId: selectedVariant?.id ?? null,
        },
      });

      router.push("/mini-cart", { scroll: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      color="primary"
      variant="contained"
      loading={isLoading}
      onClick={handleAddToCart}
      disabled={isOutOfStock}
      sx={{ mb: 4.5, px: "1.75rem", height: 40 }}
    >
      {isOutOfStock ? "Out of Stock" : "Add to Cart"}
    </Button>
  );
}
