"use client";

import Link from "next/link";
import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircle from "@mui/icons-material/CheckCircle";
import CompareArrows from "@mui/icons-material/CompareArrows";
import ContentCopy from "@mui/icons-material/ContentCopy";

import AddToCart from "./add-to-cart";
import ProductGallery from "./product-gallery";
import WishlistToggleButton from "components/wishlist/wishlist-toggle-button";
import StarRating from "components/ratings/StarRating";
import VariantSelector from "components/product-variants/VariantSelector";
import { formatStoreCurrency } from "utils/currency";
import { useCompare } from "contexts/CompareContext";
import { StyledRoot } from "./styles";

function AvailabilityBadge({ available }) {
  return available
    ? <Chip label="متوفر" color="success" size="small" variant="outlined" />
    : <Chip label="غير متوفر" color="error" size="small" variant="filled" />;
}

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
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        رمز المنتج: <strong dir="ltr" style={{ color: "inherit", userSelect: "all" }}>{sku}</strong>
      </Typography>
      <Tooltip title={copied ? "تم النسخ" : "نسخ رمز المنتج"}>
        <Box
          component="button"
          type="button"
          onClick={handleCopy}
          aria-label="نسخ رمز المنتج"
          sx={{
            border: 0,
            p: 0,
            bgcolor: "transparent",
            cursor: "pointer",
            color: copied ? "success.main" : "action.active",
            display: "flex",
            alignItems: "center"
          }}
        >
          {copied ? <CheckCircle sx={{ fontSize: 15 }} /> : <ContentCopy sx={{ fontSize: 15 }} />}
        </Box>
      </Tooltip>
    </Stack>
  );
}

export default function ProductIntro({ product }) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const defaultVariant = variants.find(variant => variant.isDefault) || null;
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);
  const commercialPrice = selectedVariant?.storefrontPrice || product.storefrontPrice || {};
  const finalPrice = Number(commercialPrice.finalPrice ?? selectedVariant?.price ?? product.price ?? 0);
  const comparePrice = Number(commercialPrice.comparePrice ?? selectedVariant?.comparePrice ?? product.comparePrice);
  const hasComparePrice = Number.isFinite(comparePrice) && comparePrice > finalPrice;
  const discountPercent = Number(commercialPrice.discountPercent || 0);
  const availableStock = Number(selectedVariant?.availableStock ?? product.availableStock ?? product.stockQty ?? 0);
  const available = availableStock > 0;
  const brandRef = product.brandRef || null;
  const brandName = brandRef?.name || product.brand || null;
  const brandSlug = brandRef?.slug || null;
  const { toggle, has } = useCompare();
  const inCompare = has(product.id);

  return (
    <StyledRoot>
      <Box className="product-intro-layout">
        <Box>
          <ProductGallery gallery={product.gallery} productName={product.title} />
        </Box>

        <Box>
          <Stack spacing={1.25}>
            {brandName ? (
              <Typography variant="body2" color="text.secondary">
                العلامة التجارية: {brandSlug ? (
                  <Link href={`/brands/${brandSlug}`} style={{ color: "inherit", fontWeight: 700 }}>
                    {brandName}
                  </Link>
                ) : <strong>{brandName}</strong>}
              </Typography>
            ) : null}

            <Typography variant="h1">{product.title}</Typography>

            {product.ratingCount > 0 && (
              <Box display="flex" alignItems="center" gap={1}>
                <StarRating value={product.ratingAvg ?? product.rating ?? 0} size="small" />
                <Typography component="a" href="#reviews" variant="body2" color="text.secondary">
                  {product.ratingCount} تقييم
                </Typography>
              </Box>
            )}

            <SkuCopy sku={product.sku} />

            {product.shortDescription && product.shortDescription.trim() !== "-" ? (
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {product.shortDescription}
              </Typography>
            ) : null}

            {variants.length > 0 && (
              <VariantSelector
                variants={variants}
                selectedId={selectedVariant?.id ?? null}
                onChange={setSelectedVariant}
              />
            )}

            <Box className="purchase-panel">
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.25}>
                <Typography variant="h2" color="primary.main" sx={{ lineHeight: 1 }}>
                  {formatStoreCurrency(finalPrice, 2, "LYD")}
                </Typography>
                {hasComparePrice && (
                  <Typography variant="body1" color="text.disabled" sx={{ textDecoration: "line-through" }}>
                    {formatStoreCurrency(comparePrice, 2, "LYD")}
                  </Typography>
                )}
                {hasComparePrice && discountPercent > 0 && (
                  <Chip label={`خصم ${Math.round(discountPercent)}%`} color="error" size="small" />
                )}
              </Stack>
              <Box mt={1}><AvailabilityBadge available={available} /></Box>
              {product.warrantyText ? (
                <Typography variant="body2" color="text.secondary" mt={1}>
                  الضمان: <strong>{product.warrantyText}</strong>
                </Typography>
              ) : null}
            </Box>

            <AddToCart product={product} selectedVariant={selectedVariant} />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <WishlistToggleButton productId={product.id} variant="button" fullWidth sx={{ minHeight: 44 }} />
              <Button
                fullWidth
                variant={inCompare ? "contained" : "outlined"}
                color={inCompare ? "secondary" : "inherit"}
                startIcon={<CompareArrows />}
                onClick={() => toggle(product)}
                sx={{ minHeight: 44, whiteSpace: "nowrap" }}
              >
                {inCompare ? "تمت الإضافة للمقارنة" : "أضف للمقارنة"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </StyledRoot>
  );
}
