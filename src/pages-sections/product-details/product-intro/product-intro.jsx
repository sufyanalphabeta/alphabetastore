import Link from "next/link";

// MUI
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// LOCAL CUSTOM COMPONENTS
import AddToCart from "./add-to-cart";
import ProductGallery from "./product-gallery";
import WishlistToggleButton from "components/wishlist/wishlist-toggle-button";

// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";

// STYLED COMPONENTS
import { StyledRoot } from "./styles";

// CUSTOM DATA MODEL


// ================================================================


// ================================================================

export default function ProductIntro({
  product
}) {
  const hasStock = product.stockQty > 0;

  return <StyledRoot>
      <Grid container spacing={3} justifyContent="space-around">
        {/* IMAGE GALLERY AREA */}
        <Grid size={{
        lg: 6,
        md: 7,
        xs: 12
      }}>
          <ProductGallery images={product.images} />
        </Grid>

        <Grid size={{
        lg: 5,
        md: 5,
        xs: 12
      }}>
          <Typography variant="h1">{product.title}</Typography>

          {product.brand ? <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
              العلامة التجارية: <strong style={{ color: "inherit" }}>{product.brand}</strong>
            </Typography> : null}

          {product.sku ? <Typography variant="body2" sx={{ mt: 0.25, color: "text.secondary" }}>
              SKU: <strong style={{ color: "inherit" }}>{product.sku}</strong>
            </Typography> : null}

          {product.categoryName ? <Typography variant="body1">
              الفئة: <strong>{product.categoryName}</strong>
            </Typography> : null}

          {product.shortDescription ? <Typography variant="body1" sx={{
          mt: 1.5,
          color: "text.secondary"
        }}>
              {product.shortDescription}
            </Typography> : null}

          {/* PRICE & STOCK */}
          <div className="price">
            <Typography variant="h2" sx={{
            color: "primary.main",
            mb: 0.5,
            lineHeight: 1
          }}>
              {currency(product.price)}
            </Typography>

            <p>{hasStock ? `المتوفر: ${product.stockQty}` : "نفدت الكمية"}</p>
          </div>

          {/* ADD TO CART BUTTON */}
          <Stack direction={{
          sm: "row",
          xs: "column"
        }} spacing={2} alignItems={{
          sm: "center",
          xs: "stretch"
        }}>
            <AddToCart product={product} />
            <WishlistToggleButton productId={product.id} variant="button" sx={{
            mb: 4.5,
            px: "1.75rem",
            height: 40
          }} />
          </Stack>
        </Grid>
      </Grid>
    </StyledRoot>;
}