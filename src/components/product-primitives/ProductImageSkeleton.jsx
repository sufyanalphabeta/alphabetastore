"use client";

import Skeleton from "@mui/material/Skeleton";

export default function ProductImageSkeleton({ aspectRatio = "1 / 1" }) {
  return <Skeleton variant="rectangular" animation="wave" width="100%" sx={{ aspectRatio }} />;
}
