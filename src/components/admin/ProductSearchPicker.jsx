"use client";

/**
 * ProductSearchPicker
 * A search-as-you-type product selector for admin panels.
 *
 * Props:
 *   value        — selected product { id, name } | null
 *   onChange     — called with { id, name, slug, sku } | null
 *   label        — TextField label (default "Search product")
 *   helperText   — optional helper text
 *   error        — boolean
 *   size         — "small" | "medium"
 *   disabled     — boolean
 */

import { useCallback, useEffect, useRef, useState } from "react";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";

import { fetchAdminProducts } from "utils/admin-catalog";

const MIN_QUERY_LENGTH = 1;
const DEBOUNCE_MS = 300;

export default function ProductSearchPicker({
  value = null,
  onChange,
  label = "Search product",
  helperText,
  error = false,
  size = "small",
  disabled = false,
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  // If value changes externally, sync input text
  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value]);

  const search = useCallback(async (q) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAdminProducts({ q, limit: 10 });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setResults(items);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    if (value) {
      // User is typing again — clear the selection
      onChange?.(null);
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), DEBOUNCE_MS);
  };

  const handleSelect = (product) => {
    onChange?.({ id: product.id, name: product.name, slug: product.slug, sku: product.sku });
    setQuery(product.name);
    setOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery("");
    onChange?.(null);
    setOpen(false);
    setResults([]);
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: "relative" }}>
        <TextField
          label={label}
          value={query}
          onChange={handleInputChange}
          size={size}
          fullWidth
          disabled={disabled}
          error={error}
          helperText={helperText}
          autoComplete="off"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? (
                    <CircularProgress size={16} />
                  ) : (
                    <SearchIcon fontSize="small" color="action" />
                  )}
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClear} edge="end">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />

        {/* Selected value chip */}
        {value && (
          <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: "block" }}>
            ✓ Selected: {value.name}
            {value.sku ? ` (SKU: ${value.sku})` : ""}
          </Typography>
        )}

        {/* Dropdown results */}
        {open && results.length > 0 && (
          <Paper
            elevation={8}
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 1400,
              mt: 0.5,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            <List dense disablePadding>
              {results.map((product) => (
                <ListItemButton
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  divider
                >
                  <ListItemText
                    primary={product.name}
                    secondary={
                      [product.sku ? `SKU: ${product.sku}` : null, product.status]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                    slotProps={{
                      primary: { variant: "body2", fontWeight: 500 },
                      secondary: { variant: "caption" },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}

        {open && !loading && results.length === 0 && query.length >= MIN_QUERY_LENGTH && (
          <Paper elevation={4} sx={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1400, mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No products found for &quot;{query}&quot;
            </Typography>
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
}
