"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

const LABELS = {
  ADD_TO_CART: "أضف إلى السلة",
  VIEW_DETAILS: "عرض التفاصيل",
  VIEW_OPTIONS: "اختر الخيارات",
  OUT_OF_STOCK: "غير متوفر"
};

export default function ProductPrimaryAction({ action = "ADD_TO_CART", label, loading = false, disabled = false, onClick, fullWidth = true, startIcon, ...props }) {
  const blocked = disabled || loading || action === "OUT_OF_STOCK";
  return (
    <Button
      variant="contained"
      fullWidth={fullWidth}
      disabled={blocked}
      onClick={onClick}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : startIcon}
      sx={{
        minHeight: 44,
        bgcolor: "var(--store-cta-bg)",
        color: "var(--store-cta-text)",
        borderRadius: "var(--store-control-radius, 4px)",
        boxShadow: "none",
        fontWeight: 700,
        "&:hover": { bgcolor: "var(--store-cta-hover)", boxShadow: "none" },
        "&:focus-visible": { outline: "3px solid color-mix(in srgb, var(--store-primary) 35%, transparent)", outlineOffset: 2 }
      }}
      {...props}>
      {label || LABELS[action] || LABELS.ADD_TO_CART}
    </Button>
  );
}
