"use client";

import ImageNotSupportedOutlined from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function ProductPlaceholder({ label = "لا توجد صورة", compact = false }) {
  return (
    <Box
      role="img"
      aria-label={label}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
      width="100%"
      height="100%"
      minHeight={compact ? 96 : 180}
      bgcolor="var(--store-surface-subtle, var(--store-secondary-surface))"
      color="var(--store-text-secondary)">
      <ImageNotSupportedOutlined sx={{ fontSize: compact ? 30 : 44 }} />
      {!compact ? <Typography variant="caption">{label}</Typography> : null}
    </Box>
  );
}
