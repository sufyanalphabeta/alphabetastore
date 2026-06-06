import Link from "next/link";
import { useState } from "react";

// MUI
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ContentCopy from "@mui/icons-material/ContentCopy";
import CheckCircle from "@mui/icons-material/CheckCircle";
import CompareArrows from "@mui/icons-material/CompareArrows";

// LOCAL CUSTOM COMPONENTS
import AddToCart from "./add-to-cart";
import ProductGallery from "./product-gallery";
import WishlistToggleButton from "components/wishlist/wishlist-toggle-button";
import StarRating from "components/ratings/StarRating";
import VariantSelector from "components/product-variants/VariantSelector";

// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";

// COMPARE CONTEXT
import { useCompare } from "contexts/CompareContext";

// STYLED COMPONENTS
import { StyledRoot } from "./styles";

// ── Availability badge ────────────────────────────────────────────────────────
function AvailabilityBadge({ stockQty }) {
  if (stockQty <= 0) {
    return <Chip label="Out of Stock" color="error" size="small" variant="filled" />;
  }
  if (stockQty <= 5) {
    return <Chip label={`Low Stock — ${stockQty} left`} color="warning" size="small" variant="outlined" />;
  }
  return <Chip label="In Stock" color="success" size="small" variant="outlined" />;
}

// ── SKU copy button ───────────────────────────────────────────────────────────
function SkuCopy({ sku }) {
  const [copied, setCopied] = useState(false);

  if (!sku) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(sku).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        SKU:&nbsp;<strong style={{ color: "inherit", userSelect: "all" }}>{sku}</strong>
      </Typography>
      <Tooltip title={copied ? "Copied!" : "Copy SKU"}>
        <Box
          component="span"
          onClick={handleCopy}
          sx={{ cursor: "pointer", color: copied ? "success.main" : "action.active", display: "flex", alignItems: "center" }}
        >
          {copied
            ? <CheckCircle fontSize="inherit" sx={{ fontSize: 14 }} />
            : <ContentCopy fontSize="inherit" sx={{ fontSize: 14 }} />}
        </Box>
      </Tooltip>
    </Stack>
  );
}

// ── Highlights list ───────────────────────────────────────────────────────────
function HighlightsList({ highlights }) {
  if (!Array.isArray(highlights) || !highlights.length) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Key Features
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {highlights.map((item, i) => (
          <Typography key={i} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {item}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

// ================================================================
export default function ProductIntro({ product }) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const defaultVariant = variants.find(v => v.isDefault) || variants[0] || null;
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);

  // Effective price/stock: use selected variant if present, else product
  const effectivePrice = selectedVariant ? Number(selectedVariant.price) : (product.price ?? 0);
  const effectiveCompare = selectedVariant?.comparePrice
    ? Number(selectedVariant.comparePrice)
    : (product.comparePrice ? Number(product.comparePrice) : null);
  const effectiveStock = selectedVariant ? selectedVariant.stockQty : (product.stockQty ?? 0);

  const stockQty = effectiveStock;
  const brandRef = product.brandRef || null;
  const brandName = brandRef?.name || product.brand || null;
  const brandSlug = brandRef?.slug || null;
  const { toggle, has } = useCompare();
  const inCompare = has(product.id);

  return (
    <StyledRoot>
      <Grid container spacing={3} justifyContent="space-around">
        {/* IMAGE GALLERY AREA */}
        <Grid size={{ lg: 6, md: 7, xs: 12 }}>
          <ProductGallery images={product.images} productName={product.title} />
        </Grid>

        <Grid size={{ lg: 5, md: 5, xs: 12 }}>
          <Typography variant="h1">{product.title}</Typography>

          {/* Rating summary link */}
          {product.ratingCount > 0 && (
            <Box display="flex" alignItems="center" gap={1} mt={0.75} mb={0.25}>
              <StarRating value={product.ratingAvg ?? product.rating ?? 0} size="small" />
              <Typography
                component="a"
                href="#reviews"
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: "underline", cursor: "pointer" }}
              >
                {product.ratingCount} review{product.ratingCount !== 1 ? "s" : ""}
              </Typography>
            </Box>
          )}

          {/* Brand */}
          {brandName ? (
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
              Brand:{" "}
              {brandSlug ? (
                <Link href={`/brands/${brandSlug}`} style={{ color: "inherit", fontWeight: 600 }}>
                  {brandName}
                </Link>
              ) : (
                <strong style={{ color: "inherit" }}>{brandName}</strong>
              )}
            </Typography>
          ) : null}

          {/* SKU with copy */}
          <SkuCopy sku={product.sku} />

          {/* Category breadcrumb */}
          {product.categoryName ? (
            <Typography variant="body2" sx={{ mt: 0.25, color: "text.secondary" }}>
              Category:{" "}
              {product.categorySlug ? (
                <Link href={`/products/search?category=${product.categorySlug}`} style={{ color: "inherit", fontWeight: 600 }}>
                  {product.categoryName}
                </Link>
              ) : (
                <strong style={{ color: "inherit" }}>{product.categoryName}</strong>
              )}
            </Typography>
          ) : null}

          {product.shortDescription ? (
            <Typography variant="body1" sx={{ mt: 1.5, color: "text.secondary" }}>
              {product.shortDescription}
            </Typography>
          ) : null}

          {/* Key features / highlights */}
          <HighlightsList highlights={product.highlights} />

          {/* VARIANT SELECTOR */}
          {variants.length > 0 && (
            <VariantSelector
              variants={variants}
              selectedId={selectedVariant?.id ?? null}
              onChange={setSelectedVariant}
            />
          )}

          {/* PRICE & STOCK */}
          <Box sx={{ pt: 2, mb: 3 }}>
            <Stack direction="row" alignItems="baseline" spacing={1.5}>
              <Typography variant="h2" sx={{ color: "primary.main", lineHeight: 1 }}>
                {currency(effectivePrice)}
              </Typography>
              {effectiveCompare && effectiveCompare > effectivePrice && (
                <Typography variant="body1" color="text.disabled" sx={{ textDecoration: "line-through" }}>
                  {currency(effectiveCompare)}
                </Typography>
              )}
            </Stack>
            <Box mt={0.75}>
              <AvailabilityBadge stockQty={stockQty} />
            </Box>
          </Box>

          {/* ADD TO CART BUTTON */}
          <Stack
            direction={{ sm: "row", xs: "column" }}
            spacing={2}
            alignItems={{ sm: "center", xs: "stretch" }}
          >
            <AddToCart product={product} selectedVariant={selectedVariant} />
            <WishlistToggleButton
              productId={product.id}
              variant="button"
              sx={{ mb: 4.5, px: "1.75rem", height: 40 }}
            />
            <Button
              variant={inCompare ? "contained" : "outlined"}
              color={inCompare ? "secondary" : "inherit"}
              size="small"
              startIcon={<CompareArrows />}
              onClick={() => toggle(product)}
              sx={{ height: 40, px: 2, whiteSpace: "nowrap" }}
            >
              {inCompare ? "In Compare" : "Add to Compare"}
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </StyledRoot>
  );
}
