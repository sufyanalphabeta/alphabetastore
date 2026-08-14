"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronLeft from "@mui/icons-material/ChevronLeft";

const FILTER_KEYS = ["category", "brand", "brandId", "brandSlug", "availability", "inStock", "minPrice", "maxPrice"];

function CategoryRow({ item, depth, selected, expanded, onToggle, onSelect }) {
  const children = Array.isArray(item?.children) ? item.children : [];
  const isOpen = expanded.has(item.slug);
  const isSelected = selected === item.slug;

  return <Box>
    <Stack direction="row" alignItems="center" sx={{ minHeight: 38, ps: depth * 1.25 }}>
      <Button variant="text" color={isSelected ? "primary" : "inherit"} onClick={() => onSelect(item.slug)}
        sx={{ flex: 1, justifyContent: "space-between", px: 0.5, fontWeight: isSelected ? 800 : 500, textAlign: "start" }}>
        <span>{item?.name || item?.title || ""}</span>
        {item.productCount != null ? <Chip size="small" label={item.productCount} sx={{ height: 22, ms: 1 }} /> : null}
      </Button>
      {children.length ? <IconButton size="small" aria-label="عرض الفئات الفرعية" onClick={() => onToggle(item.slug)}>
        {isOpen ? <ExpandMore fontSize="small" /> : <ChevronLeft fontSize="small" />}
      </IconButton> : null}
    </Stack>
    {isOpen ? children.map(child => <CategoryRow key={child.id || child.slug} item={child} depth={depth + 1}
      selected={selected} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />) : null}
  </Box>;
}

export default function ProductFilters({ filters = {}, onClose }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categories = useMemo(() => filters.categories || [], [filters.categories]);
  const brands = useMemo(() => filters.brands || [], [filters.brands]);
  const selectedCategory = searchParams.get("category") || filters.fixedCategory || "";
  const selectedBrandId = searchParams.get("brandId") || "";
  const selectedBrand = searchParams.get("brandSlug") || searchParams.get("brand") || "";
  const availability = searchParams.get("availability") || (searchParams.get("inStock") === "true" ? "in-stock" : "");
  const [brandQuery, setBrandQuery] = useState("");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
  }, [searchParams]);

  useEffect(() => {
    setExpanded(current => current.size ? current : new Set(categories.slice(0, 2).map(item => item.slug)));
  }, [categories]);

  const navigate = changes => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    onClose?.();
  };

  const visibleBrands = useMemo(() => {
    const term = brandQuery.trim().toLocaleLowerCase("ar");
    return brands.filter(brand => brand.productCount == null || Number(brand.productCount) > 0)
      .filter(brand => !term || brand.name.toLocaleLowerCase("ar").includes(term));
  }, [brandQuery, brands]);

  const activeCount = [searchParams.get("category"), selectedBrandId || selectedBrand, availability,
    searchParams.get("minPrice"), searchParams.get("maxPrice")].filter(Boolean).length;

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);
    FILTER_KEYS.forEach(key => params.delete(key));
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    onClose?.();
  };

  const toggleCategory = slug => setExpanded(current => {
    const next = new Set(current);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    return next;
  });

  return <Box sx={{ p: { xs: 1.5, md: 2 }, bgcolor: "background.paper", borderRadius: 2 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
      <Typography variant="h6" fontWeight={800}>تصفية المنتجات</Typography>
      {activeCount ? <Chip size="small" color="primary" label={`${activeCount} نشط`} /> : null}
    </Stack>

    {categories.length ? <>
      <Typography fontWeight={800} mb={0.75}>الفئات</Typography>
      <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
        {categories.map(item => <CategoryRow key={item.id || item.slug} item={item} depth={0}
          selected={selectedCategory} expanded={expanded} onToggle={toggleCategory}
          onSelect={slug => navigate({ category: selectedCategory === slug && !filters.fixedCategory ? "" : slug })} />)}
      </Box>
      <Divider sx={{ my: 2 }} />
    </> : null}

    <Typography fontWeight={800} mb={0.5}>التوفر</Typography>
    <FormControlLabel label={`متوفر${filters.availability?.inStock != null ? ` (${filters.availability.inStock})` : ""}`}
      control={<Checkbox checked={availability === "in-stock"} onChange={() => navigate({ availability: availability === "in-stock" ? "" : "in-stock", inStock: "" })} />} />
    <FormControlLabel label={`غير متوفر${filters.availability?.outOfStock != null ? ` (${filters.availability.outOfStock})` : ""}`}
      control={<Checkbox checked={availability === "out-of-stock"} onChange={() => navigate({ availability: availability === "out-of-stock" ? "" : "out-of-stock", inStock: "" })} />} />

    <Divider sx={{ my: 2 }} />
    <Typography fontWeight={800} mb={1}>السعر بالدينار الليبي</Typography>
    <Stack direction="row" spacing={1}>
      <TextField size="small" type="number" label="من" value={minPrice} onChange={event => setMinPrice(event.target.value)} inputProps={{ min: 0 }} />
      <TextField size="small" type="number" label="إلى" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} inputProps={{ min: 0 }} />
    </Stack>
    <Button fullWidth variant="outlined" sx={{ mt: 1 }} onClick={() => navigate({ minPrice: Number(minPrice) >= 0 && minPrice !== "" ? minPrice : "", maxPrice: Number(maxPrice) > 0 ? maxPrice : "" })}>تطبيق السعر</Button>

    {visibleBrands.length ? <>
      <Divider sx={{ my: 2 }} />
      <Typography fontWeight={800} mb={1}>العلامة التجارية</Typography>
      {brands.length > 6 ? <TextField fullWidth size="small" value={brandQuery} onChange={event => setBrandQuery(event.target.value)} placeholder="ابحث عن علامة تجارية" sx={{ mb: 1 }} /> : null}
      <Box sx={{ maxHeight: 240, overflowY: "auto" }}>
        {visibleBrands.map(brand => {
          const checked = selectedBrandId ? selectedBrandId === brand.id : selectedBrand === brand.slug;
          return <FormControlLabel key={brand.id} label={`${brand.name} (${brand.productCount || 0})`}
            control={<Checkbox checked={checked} onChange={() => navigate(checked ? { brandId: "", brandSlug: "", brand: "" } : { brandId: brand.id, brandSlug: "", brand: "" })} />}
            sx={{ display: "flex", m: 0 }} />;
        })}
      </Box>
    </> : null}

    {activeCount ? <Button fullWidth color="error" variant="text" onClick={clearFilters} sx={{ mt: 2 }}>مسح كل الفلاتر</Button> : null}
  </Box>;
}
