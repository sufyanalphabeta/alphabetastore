"use client";

// MUI
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";

// UTILS
import Link from "next/link";
import { currency } from "lib";
import { normalizeProductImageUrl } from "utils/catalog";

// ── Single bundle card ────────────────────────────────────────────────────────

function BundleCard({ bundle }) {
  const items = Array.isArray(bundle?.items) ? bundle.items : [];
  const totalProductPrice = items.reduce((sum, item) => {
    return sum + Number(item?.product?.price ?? 0) * (item?.quantity ?? 1);
  }, 0);
  const bundlePrice = bundle?.bundlePrice ? Number(bundle.bundlePrice) : null;
  const savings = bundlePrice && bundlePrice < totalProductPrice ? totalProductPrice - bundlePrice : null;

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
          <ShoppingBagIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>{bundle.name}</Typography>
          {savings && (
            <Chip
              label={`Save ${currency(savings)}`}
              color="success"
              size="small"
              sx={{ ml: "auto", fontWeight: 700 }}
            />
          )}
        </Stack>

        {bundle.description && (
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            {bundle.description}
          </Typography>
        )}

        {/* Product thumbnails */}
        <AvatarGroup max={6} sx={{ justifyContent: "flex-start", mb: 1.5 }}>
          {items.map(item => {
            const img = normalizeProductImageUrl(item?.product?.images?.[0]?.imageUrl);
            return (
              <Avatar
                key={item.id}
                src={img}
                alt={item?.product?.name}
                variant="rounded"
                sx={{ width: 44, height: 44, border: "1px solid", borderColor: "divider" }}
              />
            );
          })}
        </AvatarGroup>

        {/* Item list */}
        <Box mb={2}>
          {items.map(item => (
            <Stack key={item.id} direction="row" justifyContent="space-between" py={0.25}>
              <Typography variant="body2" color="text.secondary">
                {item?.quantity > 1 ? `${item.quantity}× ` : ""}{item?.product?.name}
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {currency(Number(item?.product?.price ?? 0))}
              </Typography>
            </Stack>
          ))}
        </Box>

        <Stack direction="row" alignItems="center" spacing={2}>
          <Box>
            {bundlePrice ? (
              <>
                <Typography variant="caption" color="text.disabled" sx={{ textDecoration: "line-through" }}>
                  {currency(totalProductPrice)}
                </Typography>
                <Typography variant="h5" color="primary.main" fontWeight={700}>
                  {currency(bundlePrice)}
                </Typography>
              </>
            ) : (
              <Typography variant="h5" color="primary.main" fontWeight={700}>
                {currency(totalProductPrice)}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            size="small"
            sx={{ ml: "auto" }}
            component="a"
            href={`/bundles/${bundle.slug}`}
          >
            View Bundle
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Bundles section ───────────────────────────────────────────────────────────

export default function ProductBundles({ bundles = [] }) {
  if (!bundles.length) return null;

  return (
    <Box mt={6}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Available Bundles
      </Typography>
      <Stack spacing={2}>
        {bundles.map(bundle => (
          <BundleCard key={bundle.id} bundle={bundle} />
        ))}
      </Stack>
    </Box>
  );
}
