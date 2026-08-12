"use client";

import { useState } from "react";

// MUI
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import AddIcon from "@mui/icons-material/Add";

// UTILS
import { currency } from "lib";
import { getProductCardImage } from "utils/catalog";
import { useCart } from "contexts/CartContext";

// ── Mini product tile ─────────────────────────────────────────────────────────

function FbtTile({ product, checked, onToggle }) {
  const imageUrl = getProductCardImage(product);
  const price = Number(product?.price ?? 0);
  const inStock = (product?.stockQty ?? 0) > 0;

  return (
    <Stack alignItems="center" spacing={1} sx={{ minWidth: 120, maxWidth: 160, flex: "1 1 120px" }}>
      <Box position="relative">
        <CardMedia
          component="img"
          src={imageUrl}
          alt={product?.name}
          sx={{
            width: 100,
            height: 100,
            objectFit: "contain",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            p: 0.5,
            opacity: inStock ? 1 : 0.45,
          }}
        />
        <Checkbox
          size="small"
          checked={checked}
          onChange={onToggle}
          disabled={!inStock}
          sx={{ position: "absolute", top: -8, right: -8, p: 0, bgcolor: "background.paper", borderRadius: "50%" }}
        />
      </Box>
      <Box textAlign="center">
        <Typography variant="caption" fontWeight={600} display="block" noWrap sx={{ maxWidth: 140 }}>
          {product?.name}
        </Typography>
        <Typography variant="caption" color="primary.main" fontWeight={700}>
          {currency(price)}
        </Typography>
        {!inStock && (
          <Chip label="Out of Stock" size="small" color="error" sx={{ mt: 0.25, fontSize: 10 }} />
        )}
      </Box>
    </Stack>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FrequentlyBoughtTogether({ mainProduct, relatedProducts = [] }) {
  const { addItem } = useCart();
  const allProducts = [mainProduct, ...relatedProducts].filter(Boolean);

  const [selected, setSelected] = useState(
    new Set(allProducts.filter(p => (p?.stockQty ?? 0) > 0).map(p => p.id))
  );

  if (!relatedProducts.length) return null;

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedItems = allProducts.filter(p => selected.has(p.id));
  const totalPrice = selectedItems.reduce((sum, p) => sum + Number(p?.price ?? 0), 0);

  const handleAddAll = () => {
    for (const p of selectedItems) {
      addItem?.(p.id, 1);
    }
  };

  return (
    <Box mt={6}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Frequently Bought Together
      </Typography>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          flexWrap="wrap"
          divider={
            <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", px: 0.5 }}>
              <AddIcon fontSize="small" color="disabled" />
            </Box>
          }
          spacing={1}
        >
          {allProducts.map((p, idx) => (
            <FbtTile
              key={p.id}
              product={p}
              checked={selected.has(p.id)}
              onToggle={() => toggle(p.id)}
            />
          ))}
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
            </Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              Total: {currency(totalPrice)}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddShoppingCartIcon />}
            onClick={handleAddAll}
            disabled={selectedItems.length === 0}
            sx={{ ml: { sm: "auto" } }}
          >
            Add {selectedItems.length > 1 ? "All" : ""} to Cart
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}
