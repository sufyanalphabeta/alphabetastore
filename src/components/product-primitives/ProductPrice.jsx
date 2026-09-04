"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatStoreCurrency } from "utils/currency";

export default function ProductPrice({ price = 0, comparePrice = null, currency = "LYD", size = "medium" }) {
  const current = Number(price);
  const previous = comparePrice == null ? null : Number(comparePrice);
  const typography = size === "large" ? "h4" : size === "small" ? "body2" : "h6";
  const hasComparison = Number.isFinite(previous) && previous > current;

  return (
    <Box display="flex" alignItems="baseline" flexWrap="wrap" gap={1}>
      <Typography
        component="span"
        variant={typography}
        fontWeight={700}
        color="var(--store-price, var(--store-text-primary))"
        dir="ltr"
        sx={{ fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
        {formatStoreCurrency(Number.isFinite(current) ? current : 0, 2, currency)}
      </Typography>
      {hasComparison ? (
        <Typography
          component="del"
          variant="body2"
          color="var(--store-price-muted, var(--store-text-secondary))"
          dir="ltr"
          sx={{ fontVariantNumeric: "tabular-nums" }}>
          {formatStoreCurrency(previous, 2, currency)}
        </Typography>
      ) : null}
    </Box>
  );
}
