"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// MUI
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";

// CONTEXTS & UTILS
import { useCompare } from "contexts/CompareContext";
import { currency } from "lib";
import { normalizeProductImageUrl } from "utils/catalog";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SpecRow({ label, values }) {
  const hasAnyValue = values.some(v => v !== null && v !== undefined && v !== "");
  if (!hasAnyValue) return null;

  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", width: 160, verticalAlign: "top" }}>
        {label}
      </TableCell>
      {values.map((val, i) => (
        <TableCell key={i} sx={{ verticalAlign: "top" }}>
          {val ?? <Typography variant="body2" color="text.disabled">—</Typography>}
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { items, remove, clear } = useCompare();
  const [hydrated, setHydrated] = useState(false);

  // Wait for localStorage hydration to avoid SSR mismatch
  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <Box maxWidth={600} mx="auto" mt={8} textAlign="center" px={2}>
        <CompareArrowsIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          No products to compare
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Browse products and click &quot;Add to Compare&quot; to compare up to 4 products side by side.
        </Typography>
        <Button variant="contained" component={Link} href="/market-1">
          Browse Products
        </Button>
      </Box>
    );
  }

  // Collect all unique spec keys from all products
  const allSpecKeys = Array.from(
    new Set(
      items.flatMap(p =>
        p.specs && typeof p.specs === "object" ? Object.keys(p.specs) : []
      )
    )
  );

  // Collect all unique highlight items (flat union, capped at 8)
  const allHighlights = Array.from(
    new Set(items.flatMap(p => (Array.isArray(p.highlights) ? p.highlights : [])))
  ).slice(0, 8);

  return (
    <Box px={{ xs: 2, md: 4 }} py={4} maxWidth={1200} mx="auto">
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CompareArrowsIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>
            Compare Products
          </Typography>
          <Chip label={`${items.length} / 4`} size="small" color="primary" variant="outlined" />
        </Stack>
        <Button variant="outlined" color="error" size="small" onClick={clear}>
          Clear All
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: "grey.50", width: 160 }}>Product</TableCell>
              {items.map(product => (
                <TableCell key={product.id} sx={{ verticalAlign: "top", minWidth: 200 }}>
                  <Stack spacing={1}>
                    {/* Remove button */}
                    <Stack direction="row" justifyContent="flex-end">
                      <IconButton size="small" onClick={() => remove(product.id)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    {/* Product image */}
                    <Box
                      component="img"
                      src={normalizeProductImageUrl(product.thumbnail)}
                      alt={product.title || product.name}
                      sx={{
                        width: "100%",
                        maxHeight: 160,
                        objectFit: "contain",
                        borderRadius: 1,
                        bgcolor: "grey.50",
                        p: 1,
                      }}
                    />
                    {/* Name */}
                    <Link href={`/products/${product.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ "&:hover": { color: "primary.main" } }}>
                        {product.title || product.name}
                      </Typography>
                    </Link>
                  </Stack>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {/* ── Pricing ── */}
            <SpecRow
              label="Price"
              values={items.map(p => (
                <Typography variant="h6" color="primary.main" fontWeight={700}>
                  {currency(Number(p.price ?? 0))}
                </Typography>
              ))}
            />
            <SpecRow
              label="Compare Price"
              values={items.map(p =>
                p.comparePrice && Number(p.comparePrice) > Number(p.price)
                  ? (
                    <Typography variant="body2" color="text.disabled" sx={{ textDecoration: "line-through" }}>
                      {currency(Number(p.comparePrice))}
                    </Typography>
                  )
                  : null
              )}
            />

            {/* ── Availability ── */}
            <SpecRow
              label="Availability"
              values={items.map(p => {
                const qty = p.stockQty ?? 0;
                if (qty <= 0) return <Chip label="Out of Stock" color="error" size="small" />;
                if (qty <= 5) return <Chip label={`Low — ${qty} left`} color="warning" size="small" />;
                return <Chip label="In Stock" color="success" size="small" />;
              })}
            />

            {/* ── Variants ── */}
            <SpecRow
              label="Options"
              values={items.map(p =>
                p.hasVariants
                  ? <Chip label="Multiple options" color="info" size="small" />
                  : <Typography variant="body2" color="text.secondary">Single option</Typography>
              )}
            />

            {/* ── Specs ── */}
            {allSpecKeys.length > 0 && (
              <TableRow>
                <TableCell colSpan={items.length + 1} sx={{ bgcolor: "primary.main", color: "primary.contrastText", py: 0.75 }}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: "inherit" }}>SPECIFICATIONS</Typography>
                </TableCell>
              </TableRow>
            )}
            {allSpecKeys.map(key => (
              <SpecRow
                key={key}
                label={key}
                values={items.map(p =>
                  p.specs && typeof p.specs === "object" && p.specs[key] != null
                    ? String(p.specs[key])
                    : null
                )}
              />
            ))}

            {/* ── Highlights ── */}
            {allHighlights.length > 0 && (
              <TableRow>
                <TableCell colSpan={items.length + 1} sx={{ bgcolor: "primary.main", color: "primary.contrastText", py: 0.75 }}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: "inherit" }}>KEY FEATURES</Typography>
                </TableCell>
              </TableRow>
            )}
            {allHighlights.map((highlight, i) => (
              <SpecRow
                key={i}
                label=""
                values={items.map(p =>
                  Array.isArray(p.highlights) && p.highlights.includes(highlight)
                    ? <Chip label="✓" color="success" size="small" />
                    : <Typography variant="body2" color="text.disabled">—</Typography>
                )}
              />
            ))}

            {/* ── Action row ── */}
            <TableRow>
              <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }} />
              {items.map(product => (
                <TableCell key={product.id}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    component={Link}
                    href={`/products/${product.slug}`}
                  >
                    View Product
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box mt={3}>
        <Alert severity="info" variant="outlined">
          Tip: Navigate to any product page and click <strong>Add to Compare</strong> to add more products.
        </Alert>
      </Box>
    </Box>
  );
}
