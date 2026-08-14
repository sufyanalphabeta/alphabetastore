"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// MUI
import Add from "@mui/icons-material/Add";
import Button from "@mui/material/Button";

// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";

// CUSTOM DATA MODEL


// ==============================================================


// ==============================================================

export default function AddToCart({
  product
}) {
  const {
    slug,
    title,
    thumbnail,
    price,
    id
  } = product;
  const inStock = product.inStock ?? product.availability !== "OUT_OF_STOCK";
  const {
    dispatch
  } = useCart();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const handleAddToCart = () => {
    if (!inStock || product.hasVariants) {
      router.push(`/products/${slug}`);
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      dispatch({
        type: "CHANGE_CART_AMOUNT",
        payload: {
          id,
          slug,
          price,
          title,
          thumbnail,
          qty: 1
        }
      });
      router.push("/mini-cart", {
        scroll: false
      });
      setIsLoading(false);
    }, 1000);
  };
  return <Button
      color="primary"
      variant={inStock ? "contained" : "outlined"}
      loading={isLoading}
      disabled={!inStock}
      onClick={handleAddToCart}
      fullWidth
      size="small"
      startIcon={inStock && !product.hasVariants ? <Add fontSize="small" /> : undefined}
      sx={{ minHeight: 36 }}
    >
      {!inStock ? "غير متوفر" : product.hasVariants ? "اختر الخيارات" : "أضف للسلة"}
    </Button>;
}
