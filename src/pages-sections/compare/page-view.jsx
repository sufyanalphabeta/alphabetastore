"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
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
import Close from "@mui/icons-material/Close";
import CompareArrows from "@mui/icons-material/CompareArrows";
import { useCompare } from "contexts/CompareContext";
import { currency } from "lib";
import { FALLBACK_PRODUCT_IMAGE } from "utils/catalog";

function comparisonSpecs(product) {
  if (Array.isArray(product.comparisonAttributes) && product.comparisonAttributes.length) {
    return Object.fromEntries(product.comparisonAttributes.map(item => [item.label, item.displayValue ?? item.value]));
  }
  return product.specs && typeof product.specs === "object" ? product.specs : {};
}

function AvailChip({ stockQty }) {
  if (stockQty <= 0) return <Chip label="Out of Stock" color="error" size="small" />;
  if (stockQty <= 5) return <Chip label="Low Stock" color="warning" size="small" />;
  return <Chip label="In Stock" color="success" size="small" />;
}

export default function ComparePageView() {
  const { items, remove, clear, count } = useCompare();

  // Collect all unique spec keys across all compared products
  const allSpecKeys = useMemo(() => {
    const keys = new Set();
    items.forEach(p => {
      Object.keys(comparisonSpecs(p)).forEach(k => keys.add(k));
    });
    return [...keys];
  }, [items]);

  if (count === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: "center" }}>
        <CompareArrows sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
        <Typography variant="h4" gutterBottom>No products to compare</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Browse products and click "Add to Compare" to compare up to 4 products side by side.
        </Typography>
        <Button component={Link} href="/products/search" variant="contained" color="primary">
          Browse Products
        </Button>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          Product Comparison
        </Typography>
        <Button variant="outlined" size="small" onClick={clear} startIcon={<Close />}>
          Clear All
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 160, fontWeight: 700, bgcolor: "grey.50" }}>Product</TableCell>
              {items.map(p => (
                <TableCell key={p.id} align="center" sx={{ bgcolor: "grey.50", minWidth: 200 }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>
                    <IconButton
                      size="small"
                      onClick={() => remove(p.id)}
                      sx={{ position: "absolute", top: -8, right: -24, color: "error.main" }}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ width: 100, height: 100, mx: "auto", position: "relative", mb: 1 }}>
                    <Image
                      fill
                      src={p.thumbnail || FALLBACK_PRODUCT_IMAGE}
                      alt={p.title}
                      sizes="100px"
                      style={{ objectFit: "contain" }}
                    />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={700} noWrap title={p.title}>
                    <Link href={`/products/${p.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {p.title}
                    </Link>
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Price */}
            <TableRow hover>
              <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Price</TableCell>
              {items.map(p => (
                <TableCell key={p.id} align="center">
                  <Typography variant="h6" color="primary" fontWeight={700}>
                    {currency(p.price)}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>

            {/* Brand */}
            <TableRow hover>
              <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Brand</TableCell>
              {items.map(p => (
                <TableCell key={p.id} align="center">
                  <Typography variant="body2">{p.brandRef?.name || p.brand || "—"}</Typography>
                </TableCell>
              ))}
            </TableRow>

            {/* SKU */}
            <TableRow hover>
              <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>SKU</TableCell>
              {items.map(p => (
                <TableCell key={p.id} align="center">
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    {p.sku || "—"}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>

            {/* Category */}
            <TableRow hover>
              <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Category</TableCell>
              {items.map(p => (
                <TableCell key={p.id} align="center">
                  <Typography variant="body2">{p.categoryName || "—"}</Typography>
                </TableCell>
              ))}
            </TableRow>

            {/* Availability */}
            <TableRow hover>
              <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Availability</TableCell>
              {items.map(p => (
                <TableCell key={p.id} align="center">
                  <AvailChip stockQty={p.stockQty} />
                </TableCell>
              ))}
            </TableRow>

            {/* Specification rows */}
            {allSpecKeys.map(key => (
              <TableRow key={key} hover>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>{key}</TableCell>
                {items.map(p => {
                  const val = comparisonSpecs(p)[key];
                  return (
                    <TableCell key={p.id} align="center">
                      <Typography variant="body2">{val !== undefined && val !== null ? String(val) : "—"}</Typography>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

            {/* Action row */}
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Action</TableCell>
              {items.map(p => (
                <TableCell key={p.id} align="center">
                  <Button
                    component={Link}
                    href={`/products/${p.slug}`}
                    variant="outlined"
                    size="small"
                  >
                    View Product
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
