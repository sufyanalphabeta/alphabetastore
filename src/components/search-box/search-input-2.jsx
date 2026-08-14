"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// MUI
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CategoryIcon from "@mui/icons-material/Category";

// UTILS
import { fetchAutocomplete, fetchPopularSearches, getProductCardImage, trackSearchTerm } from "utils/catalog";
import { formatStoreCurrency } from "utils/currency";

// STYLED COMPONENT
import { SearchOutlinedIcon } from "./styles";

const RECENT_SEARCHES_KEY = "ab_recent_searches";
const MAX_RECENT = 6;

function getRecentSearches() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(term) {
  if (!term || term.trim().length < 2) return;
  try {
    const prev = getRecentSearches().filter(t => t !== term.trim());
    const next = [term.trim(), ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function SearchInput2() {
  return (
    <Suspense fallback={null}>
      <SearchInput2Inner />
    </Suspense>
  );
}

function SearchInput2Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState({ products: [], brands: [], categories: [] });
  const [popularSearches, setPopularSearches] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const containerRef = useRef(null);
  const debouncedSearch = useDebounce(search, 280);

  // Load popular searches once
  useEffect(() => {
    fetchPopularSearches(6).then(setPopularSearches).catch(() => {});
  }, []);

  // Load recent searches when dropdown opens
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

  // Autocomplete when debounced query changes
  useEffect(() => {
    const term = debouncedSearch.trim();
    if (term.length < 2) {
      setSuggestions({ products: [], brands: [], categories: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAutocomplete(term, 5).then(data => {
      setSuggestions(data || { products: [], brands: [], categories: [] });
      setLoading(false);
    }).catch(() => {
      setSuggestions({ products: [], brands: [], categories: [] });
      setLoading(false);
    });
  }, [debouncedSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navigate = useCallback((term) => {
    if (!term || !term.trim()) return;
    const t = term.trim();
    saveRecentSearch(t);
    trackSearchTerm(t).catch(() => {});
    const params = new URLSearchParams(searchParams);
    params.set("q", t);
    params.delete("page");
    router.push(`/products/search?${params.toString()}`);
    setSearch("");
    setOpen(false);
  }, [router, searchParams]);

  const handleSearch = useCallback(() => navigate(search), [navigate, search]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") setOpen(false);
  }, [handleSearch]);

  const hasSuggestions =
    suggestions.products.length > 0 ||
    suggestions.brands.length > 0 ||
    suggestions.categories.length > 0;

  const showDropdown = open && (search.trim().length >= 2 ? hasSuggestions || loading : recentSearches.length > 0 || popularSearches.length > 0);

  return (
    <Box position="relative" flex="1 1 0" maxWidth={670} mx="auto" ref={containerRef}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="ابحث عن منتج أو علامة تجارية أو تصنيف..."
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        slotProps={{
          input: {
            sx: {
              border: 0,
              height: 44,
              paddingRight: 0,
              overflow: "hidden",
              backgroundColor: "grey.50",
              "& .MuiOutlinedInput-notchedOutline": { border: 0 }
            },
            endAdornment: (
              <Button
                color="primary"
                disableElevation
                variant="contained"
                onClick={handleSearch}
                sx={{ px: "3rem", height: "100%", borderRadius: "0 4px 4px 0" }}
              >
                {loading ? <CircularProgress size={16} color="inherit" /> : "بحث"}
              </Button>
            ),
            startAdornment: <SearchOutlinedIcon fontSize="small" />
          }
        }}
      />

      {showDropdown && (
        <Paper
          elevation={8}
          sx={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 1400,
            maxHeight: 480,
            overflowY: "auto",
            borderRadius: 1
          }}
        >
          {/* Recent searches — shown when query < 2 chars */}
          {search.trim().length < 2 && recentSearches.length > 0 && (
            <>
              <Box px={2} py={1} display="flex" alignItems="center" gap={1}>
                <AccessTimeIcon fontSize="small" color="disabled" />
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                  عمليات البحث الأخيرة
                </Typography>
              </Box>
              <Box px={2} pb={1} display="flex" flexWrap="wrap" gap={0.75}>
                {recentSearches.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    size="small"
                    onClick={() => navigate(t)}
                    sx={{ cursor: "pointer" }}
                  />
                ))}
              </Box>
              <Divider />
            </>
          )}

          {/* Popular searches — shown when query < 2 chars */}
          {search.trim().length < 2 && popularSearches.length > 0 && (
            <>
              <Box px={2} py={1} display="flex" alignItems="center" gap={1}>
                <TrendingUpIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                  الأكثر بحثًا
                </Typography>
              </Box>
              <Box px={2} pb={1} display="flex" flexWrap="wrap" gap={0.75}>
                {popularSearches.map((p) => (
                  <Chip
                    key={p.term}
                    label={p.term}
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(p.term)}
                    sx={{ cursor: "pointer" }}
                  />
                ))}
              </Box>
            </>
          )}

          {/* Autocomplete results */}
          {search.trim().length >= 2 && (
            <>
              {suggestions.categories.length > 0 && (
                <>
                  <Box px={2} pt={1} pb={0.5} display="flex" alignItems="center" gap={1}>
                    <CategoryIcon fontSize="small" color="disabled" />
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                      الفئات
                    </Typography>
                  </Box>
                  <List dense disablePadding>
                    {suggestions.categories.map((cat) => (
                      <ListItem key={cat.id} disablePadding>
                        <ListItemButton onClick={() => router.push(`/categories/${cat.slug}`)}>
                          <ListItemText
                            primary={cat.name}
                            primaryTypographyProps={{ variant: "body2" }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                  <Divider />
                </>
              )}

              {suggestions.brands.length > 0 && (
                <>
                  <Box px={2} pt={1} pb={0.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                      العلامات التجارية
                    </Typography>
                  </Box>
                  <List dense disablePadding>
                    {suggestions.brands.map((brand) => (
                      <ListItem key={brand.id} disablePadding>
                        <ListItemButton onClick={() => router.push(`/brands/${brand.slug}`)}>
                          <ListItemAvatar sx={{ minWidth: 40 }}>
                            <Avatar
                              src={brand.logoUrl || ""}
                              alt={brand.name}
                              variant="rounded"
                              sx={{ width: 28, height: 28 }}
                            />
                          </ListItemAvatar>
                          <ListItemText
                            primary={brand.name}
                            primaryTypographyProps={{ variant: "body2" }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                  <Divider />
                </>
              )}

              {suggestions.products.length > 0 && (
                <>
                  <Box px={2} pt={1} pb={0.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                      المنتجات
                    </Typography>
                  </Box>
                  <List dense disablePadding>
                    {suggestions.products.map((product) => {
                      const img = getProductCardImage(product);
                      const price = product?.storefrontPrice?.finalPrice ?? product?.price;
                      return (
                        <ListItem key={product.id} disablePadding>
                          <ListItemButton onClick={() => router.push(`/products/${product.slug}`)}>
                            <ListItemAvatar sx={{ minWidth: 48 }}>
                              <Avatar
                                src={img}
                                alt={product.name}
                                variant="rounded"
                                sx={{ width: 36, height: 36 }}
                              />
                            </ListItemAvatar>
                            <ListItemText
                              primary={product.name}
                              secondary={`${product.category?.name || product.brand || ""}${price != null ? ` • ${formatStoreCurrency(price)}` : ""}`}
                              primaryTypographyProps={{ variant: "body2", noWrap: true }}
                              secondaryTypographyProps={{ variant: "caption" }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>

                  <Divider />
                  <ListItemButton
                    onClick={handleSearch}
                    sx={{ justifyContent: "center", py: 0.75 }}
                  >
                    <Typography variant="body2" color="primary">
                      عرض كل النتائج عن &ldquo;{search}&rdquo;
                    </Typography>
                  </ListItemButton>
                </>
              )}

              {!loading && !hasSuggestions && (
                <Box px={2} py={2} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    لا توجد نتائج عن &ldquo;{search}&rdquo;
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
