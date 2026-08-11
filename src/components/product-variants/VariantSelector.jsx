"use client";

import { useMemo } from "react";

// MUI
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";

/**
 * VariantSelector
 *
 * Props:
 *  - variants: ProductVariant[] (from backend)
 *  - selectedId: string | null
 *  - onChange: (variant) => void
 */

export default function VariantSelector({ variants = [], selectedId, onChange }) {
  // Extract the unique attribute keys in the order they first appear
  const attributeKeys = useMemo(() => {
    const keys = [];
    for (const v of variants) {
      if (v.attributes && typeof v.attributes === "object") {
        for (const k of Object.keys(v.attributes)) {
          if (!keys.includes(k)) keys.push(k);
        }
      }
    }
    return keys;
  }, [variants]);

  if (!variants.length) return null;

  // Get all unique values for a given attribute key
  const valuesFor = (key) => {
    const seen = new Set();
    return variants
      .filter(v => v.attributes?.[key] !== undefined)
      .map(v => v.attributes[key])
      .filter(val => { if (seen.has(val)) return false; seen.add(val); return true; });
  };

  const selectedVariant = variants.find(v => v.id === selectedId) || null;

  // When the user picks a value for a specific key, find the best matching variant
  const handleSelectValue = (key, value) => {
    // Start from current selection's attributes
    const baseAttrs = selectedVariant?.attributes ?? {};
    const desiredAttrs = { ...baseAttrs, [key]: value };

    // Score each variant by how many attributes match
    let best = null;
    let bestScore = -1;
    for (const v of variants) {
      if (!v.attributes) continue;
      let score = 0;
      for (const [k, val] of Object.entries(desiredAttrs)) {
        if (v.attributes[k] === val) score++;
      }
      if (score > bestScore) { bestScore = score; best = v; }
    }
    if (best) onChange?.(best);
  };

  // Check if a given attribute value is available (any variant with that value has stock)
  const isAvailable = (key, value) =>
    variants.some(v => v.attributes?.[key] === value && v.stockQty > 0);

  return (
    <Box sx={{ mt: 2 }}>
      {attributeKeys.map(key => (
        <Box key={key} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            {key}
            {selectedVariant?.attributes?.[key] && (
              <Typography component="span" variant="body2" color="primary.main" sx={{ ml: 1, fontWeight: 500 }}>
                : {selectedVariant.attributes[key]}
              </Typography>
            )}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {valuesFor(key).map(value => {
              const isSelected = selectedVariant?.attributes?.[key] === value;
              const available = isAvailable(key, value);

              return (
                <Tooltip
                  key={value}
                  title={!available ? "Out of stock" : ""}
                  placement="top"
                  arrow
                >
                  <span>
                    <Chip
                      label={value}
                      size="small"
                      variant={isSelected ? "filled" : "outlined"}
                      color={isSelected ? "primary" : "default"}
                      onClick={() => available && handleSelectValue(key, value)}
                      disabled={!available}
                      sx={{
                        cursor: available ? "pointer" : "not-allowed",
                        fontWeight: isSelected ? 700 : 400,
                        opacity: available ? 1 : 0.5,
                        transition: "all 0.15s",
                        "&:hover": available && !isSelected
                          ? { borderColor: "primary.main", color: "primary.main" }
                          : {},
                      }}
                    />
                  </span>
                </Tooltip>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
