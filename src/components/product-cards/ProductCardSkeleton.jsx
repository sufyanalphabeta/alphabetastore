import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";

// ==============================================================
// Skeleton placeholder mimicking the shape of ProductCard16
// ==============================================================
export default function ProductCardSkeleton() {
  return (
    <Card elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      {/* Image area */}
      <Skeleton variant="rectangular" width="100%" height={220} animation="wave" />

      <Box p={2}>
        {/* Rating row */}
        <Skeleton variant="text" width="45%" height={18} animation="wave" />

        {/* Title */}
        <Skeleton variant="text" width="90%" height={22} animation="wave" sx={{ mt: 0.5 }} />
        <Skeleton variant="text" width="65%" height={22} animation="wave" />

        {/* Price */}
        <Box display="flex" alignItems="center" gap={1} mt={1.25}>
          <Skeleton variant="text" width={70} height={26} animation="wave" />
          <Skeleton variant="text" width={50} height={18} animation="wave" />
        </Box>

        {/* Button */}
        <Skeleton variant="rounded" width="100%" height={36} animation="wave" sx={{ mt: 1.5, borderRadius: 1 }} />
      </Box>
    </Card>
  );
}
