"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StarIcon from "@mui/icons-material/Star";
import StarHalfIcon from "@mui/icons-material/StarHalf";
import StarBorderIcon from "@mui/icons-material/StarBorder";

/**
 * Display-only star rating.
 *
 * @param {object} props
 * @param {number} props.value       0–5, supports half stars
 * @param {number} [props.count]     review count shown next to stars
 * @param {'small'|'medium'} [props.size]
 * @param {boolean} [props.showCount]
 */
export default function StarRating({
  value = 0,
  count,
  size = "small",
  showCount = false,
  sx = {},
}) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));
  const fontSize = size === "small" ? 16 : 22;
  const color = "#FFA41C";

  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = clamped - i;
    if (filled >= 1) return "full";
    if (filled >= 0.4) return "half";
    return "empty";
  });

  return (
    <Box display="flex" alignItems="center" gap={0.25} sx={sx}>
      {stars.map((type, i) => (
        type === "full" ? (
          <StarIcon key={i} sx={{ fontSize, color }} />
        ) : type === "half" ? (
          <StarHalfIcon key={i} sx={{ fontSize, color }} />
        ) : (
          <StarBorderIcon key={i} sx={{ fontSize, color }} />
        )
      ))}
      {showCount && count !== undefined && (
        <Typography variant="caption" color="text.secondary" ml={0.5}>
          ({count})
        </Typography>
      )}
    </Box>
  );
}
