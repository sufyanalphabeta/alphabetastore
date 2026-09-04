"use client";

import Chip from "@mui/material/Chip";

export default function PromoBadge({ label, discountPercent }) {
  const discount = Number(discountPercent);
  const text = label || (Number.isFinite(discount) && discount > 0 ? `خصم ${Math.round(discount)}%` : "عرض");
  return (
    <Chip
      size="small"
      label={text}
      sx={{ bgcolor: "var(--store-promo)", color: "var(--store-cta-text)", fontWeight: 800, height: 28 }}
    />
  );
}
