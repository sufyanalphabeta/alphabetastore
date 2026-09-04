"use client";

import Chip from "@mui/material/Chip";

const AVAILABILITY = {
  IN_STOCK: { label: "متوفر", color: "var(--store-success)", background: "color-mix(in srgb, var(--store-success) 12%, var(--store-surface))" },
  OUT_OF_STOCK: { label: "غير متوفر", color: "var(--store-error)", background: "color-mix(in srgb, var(--store-error) 10%, var(--store-surface))" }
};

export default function AvailabilityBadge({ status = "IN_STOCK", label }) {
  const state = AVAILABILITY[status] || AVAILABILITY.OUT_OF_STOCK;
  return (
    <Chip
      size="small"
      label={label || state.label}
      sx={{
        height: 26,
        bgcolor: state.background,
        color: state.color,
        border: "1px solid color-mix(in srgb, currentColor 24%, transparent)",
        fontWeight: 700
      }}
    />
  );
}
