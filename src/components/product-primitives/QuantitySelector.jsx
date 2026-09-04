"use client";

import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";

export default function QuantitySelector({ value = 1, min = 1, max, disabled = false, onChange }) {
  const quantity = Number(value) || min;
  const atMinimum = disabled || quantity <= min;
  const atMaximum = disabled || (Number.isFinite(Number(max)) && quantity >= Number(max));

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      border="1px solid var(--store-border)"
      borderRadius="var(--store-control-radius, 4px)"
      bgcolor="var(--store-surface)"
      overflow="hidden">
      <IconButton aria-label="تقليل الكمية" disabled={atMinimum} onClick={() => onChange?.(quantity - 1)} sx={{ width: 44, height: 44, borderRadius: 0 }}>
        <Remove fontSize="small" />
      </IconButton>
      <Typography component="output" aria-live="polite" minWidth={40} textAlign="center" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
        {quantity}
      </Typography>
      <IconButton aria-label="زيادة الكمية" disabled={atMaximum} onClick={() => onChange?.(quantity + 1)} sx={{ width: 44, height: 44, borderRadius: 0 }}>
        <Add fontSize="small" />
      </IconButton>
    </Box>
  );
}
