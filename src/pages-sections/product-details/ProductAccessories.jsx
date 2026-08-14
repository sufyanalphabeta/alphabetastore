"use client";

// MUI
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import LinkIcon from "@mui/icons-material/Link";

// UTILS
import Link from "next/link";
import { currency } from "lib";
import { getProductCardImage } from "utils/catalog";
import { useCart } from "contexts/CartContext";

// ── Accessory card ────────────────────────────────────────────────────────────

function AccessoryCard({ product }) {
  const { addItem } = useCart();
  const imageUrl = getProductCardImage(product);
  const price = Number(product?.price ?? 0);
  const inStock = (product?.stockQty ?? 0) > 0;

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Link href={`/products/${product.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
        <CardMedia
          component="img"
          src={imageUrl}
          alt={product?.name}
          sx={{ height: 140, objectFit: "contain", p: 1, bgcolor: "grey.50" }}
        />
      </Link>
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", pt: 1 }}>
        <Link href={`/products/${product.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
          <Typography variant="body2" fontWeight={600} gutterBottom sx={{
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>
            {product?.name}
          </Typography>
        </Link>
        <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
          {currency(price)}
        </Typography>
        {!inStock && (
          <Chip label="غير متوفر" size="small" color="error" sx={{ mt: 0.5, alignSelf: "flex-start" }} />
        )}
        <Box mt="auto" pt={1}>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<AddShoppingCartIcon />}
            disabled={!inStock}
            onClick={() => addItem?.(product.id, 1)}
          >
            أضف إلى السلة
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductAccessories({ accessories = [], title = "ملحقات متوافقة" }) {
  if (!accessories.length) return null;

  return (
    <Box mt={6}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Grid container spacing={2}>
        {accessories.map(product => (
          <Grid key={product.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
            <AccessoryCard product={product} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
