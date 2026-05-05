import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import SearchOff from "@mui/icons-material/SearchOff";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";

// ==============================================================
// Reusable illustrated empty state component
// ==============================================================

const ICONS = {
  search: SearchOff,
  orders: ShoppingBagOutlined,
  products: Inventory2Outlined,
  wishlist: FavoriteBorderOutlined,
};

export default function EmptyState({
  type = "products",
  title,
  subtitle,
  actionLabel,
  actionHref,
  icon: CustomIcon,
}) {
  const Icon = CustomIcon || ICONS[type] || Inventory2Outlined;

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      py={{ xs: 6, sm: 10 }}
      px={2}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          backgroundColor: "grey.100",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2.5,
        }}
      >
        <Icon sx={{ fontSize: 40, color: "grey.400" }} />
      </Box>

      <Typography variant="h5" fontWeight={700} mb={1} color="text.primary">
        {title || "لا توجد عناصر"}
      </Typography>

      <Typography variant="body1" color="text.secondary" maxWidth={320} mb={actionLabel ? 3 : 0}>
        {subtitle || "لا توجد نتائج تطابق بحثك. حاول تغيير الفلاتر أو الكلمات المفتاحية."}
      </Typography>

      {actionLabel && actionHref && (
        <Button
          component="a"
          href={actionHref}
          variant="contained"
          color="primary"
          size="large"
          disableElevation
          sx={{ borderRadius: 2, px: 4 }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
