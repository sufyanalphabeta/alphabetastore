import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { currency } from "lib";
import { fetchBundle } from "utils/catalog";
import { normalizeProductImageUrl } from "utils/catalog";
import BundleAddToCart from "./BundleAddToCart";

export async function generateMetadata({ params }) {
  try {
    const bundle = await fetchBundle(params.slug);
    if (!bundle) return {};
    return {
      title: `${bundle.name} Bundle — AlphaBeta Store`,
      description: bundle.description || `Save on ${bundle.name} bundle`,
    };
  } catch {
    return {};
  }
}

export default async function BundlePage({ params }) {
  let bundle;
  try {
    bundle = await fetchBundle(params.slug);
  } catch {
    notFound();
  }

  if (!bundle) notFound();

  const items = Array.isArray(bundle.items) ? bundle.items : [];
  const totalProductPrice = items.reduce((sum, item) => {
    return sum + Number(item?.product?.price ?? 0) * (item?.quantity ?? 1);
  }, 0);
  const bundlePrice = bundle.bundlePrice ? Number(bundle.bundlePrice) : null;
  const savings = bundlePrice && bundlePrice < totalProductPrice ? totalProductPrice - bundlePrice : null;

  return (
    <Box maxWidth={900} mx="auto" px={{ xs: 2, md: 4 }} py={4}>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} mb={4}>
        <Box>
          <Typography variant="h3" fontWeight={700} gutterBottom>
            {bundle.name}
          </Typography>
          {bundle.description && (
            <Typography variant="body1" color="text.secondary">
              {bundle.description}
            </Typography>
          )}
        </Box>
        {savings && (
          <Chip
            label={`Save ${currency(savings)}`}
            color="success"
            sx={{ fontWeight: 700, fontSize: "1rem", px: 1.5, py: 1 }}
          />
        )}
      </Stack>

      {/* Pricing */}
      <Box mb={4}>
        <Stack direction="row" alignItems="baseline" spacing={2}>
          <Typography variant="h4" color="primary.main" fontWeight={700}>
            {currency(bundlePrice ?? totalProductPrice)}
          </Typography>
          {bundlePrice && bundlePrice < totalProductPrice && (
            <Typography variant="h6" color="text.disabled" sx={{ textDecoration: "line-through" }}>
              {currency(totalProductPrice)}
            </Typography>
          )}
        </Stack>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Items grid */}
      <Typography variant="h5" fontWeight={700} gutterBottom>
        What&apos;s in this bundle
      </Typography>
      <Grid container spacing={3} mb={4}>
        {items.map((item) => {
          const product = item?.product;
          const imageUrl = normalizeProductImageUrl(product?.images?.[0]?.imageUrl ?? product?.thumbnail);
          return (
            <Grid key={item.id ?? item.productId} size={{ xs: 12, sm: 6, md: 4 }}>
              <Box
                component="a"
                href={`/products/${product?.slug}`}
                sx={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <Box
                  component="img"
                  src={imageUrl}
                  alt={product?.name}
                  sx={{
                    width: "100%",
                    height: 200,
                    objectFit: "contain",
                    borderRadius: 2,
                    bgcolor: "grey.50",
                    mb: 1.5,
                    p: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
                <Typography variant="subtitle1" fontWeight={600}>
                  {item.quantity > 1 ? `${item.quantity}× ` : ""}{product?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currency(Number(product?.price ?? 0))} each
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* Add all to cart */}
      <Box>
        <BundleAddToCart bundle={bundle} items={items} />
      </Box>
    </Box>
  );
}
