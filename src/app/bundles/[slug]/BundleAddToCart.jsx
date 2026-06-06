"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import useCart from "hooks/useCart";

export default function BundleAddToCart({ bundle, items }) {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleAddAll = async () => {
    setLoading(true);
    setSuccess(false);
    setError("");
    try {
      for (const item of items) {
        if (!item?.product?.id) continue;
        await addItem(item.product.id, item.quantity ?? 1);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e?.message || "Failed to add bundle to cart.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          All bundle items added to your cart!
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Button
        variant="contained"
        size="large"
        onClick={handleAddAll}
        disabled={loading}
        sx={{ minWidth: 220 }}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : "Add Bundle to Cart"}
      </Button>
    </>
  );
}
