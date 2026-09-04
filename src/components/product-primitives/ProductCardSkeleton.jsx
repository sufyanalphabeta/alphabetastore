"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import ProductImageSkeleton from "./ProductImageSkeleton";

export default function ProductCardSkeleton() {
  return (
    <Card elevation={0} sx={{ height: "100%", borderRadius: "var(--store-card-radius, 8px)", border: "1px solid var(--store-border)", overflow: "hidden" }}>
      <ProductImageSkeleton />
      <Box p={{ xs: 1.25, sm: 2 }}>
        <Skeleton width="82%" height={24} />
        <Skeleton width="58%" height={20} />
        <Box display={{ xs: "none", sm: "grid" }} gap={0.5} mt={1.25}>
          <Skeleton width="72%" height={18} />
          <Skeleton width="64%" height={18} />
          <Skeleton width="76%" height={18} />
        </Box>
        <Skeleton width="48%" height={30} sx={{ mt: 1.25 }} />
        <Skeleton variant="rounded" width="100%" height={44} sx={{ mt: 1.5, borderRadius: "var(--store-control-radius, 4px)" }} />
      </Box>
    </Card>
  );
}
