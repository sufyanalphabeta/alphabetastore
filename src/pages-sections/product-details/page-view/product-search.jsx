"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FilterList from "@mui/icons-material/FilterList";

import ProductFilters from "components/products-view/filters";
import ProductsGridView from "components/products-view/products-grid-view";
import ProductCardSkeleton from "components/product-cards/ProductCardSkeleton";
import EmptyState from "components/empty-state/EmptyState";
import {
  fetchBrandsPublic,
  fetchCategoriesTree,
  fetchCategoryBySlug,
  fetchProductsPage
} from "utils/catalog";

const SORT_OPTIONS = [
  { label: "الأكثر صلة", value: "relevance" },
  { label: "الأحدث", value: "newest" },
  { label: "السعر: من الأقل إلى الأعلى", value: "price-asc" },
  { label: "السعر: من الأعلى إلى الأقل", value: "price-desc" },
  { label: "الاسم: أبجديًا", value: "name-asc" }
];
const PAGE_SIZE = 12;

function findCategory(nodes, slug) {
  if (!slug) return null;
  for (const node of nodes || []) {
    if (node.slug === slug) return node;
    const match = findCategory(node.children, slug);
    if (match) return match;
  }
  return null;
}

function DiscoverySkeleton() {
  return <Grid container spacing={3}>
    <Grid size={{ md: 3 }} sx={{ display: { xs: "none", md: "block" } }}>
      <Skeleton variant="rounded" height={520} />
    </Grid>
    <Grid size={{ xs: 12, md: 9 }}>
      <Grid container spacing={2}>
        {Array.from({ length: 8 }, (_, index) => <Grid key={index} size={{ xs: 6, md: 4, lg: 3 }}><ProductCardSkeleton /></Grid>)}
      </Grid>
    </Grid>
  </Grid>;
}

export default function ProductSearchPageView({ fixedCategory = "", categoryData = null, fixedBrandSlug = "", brandData = null, embedded = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const page = Math.max(Number(searchParams.get("page")) || 1, 1);
  const sort = searchParams.get("sort") || "relevance";
  const category = searchParams.get("category") || fixedCategory || "";
  const brand = searchParams.get("brand") || "";
  const brandSlug = searchParams.get("brandSlug") || fixedBrandSlug || "";
  const brandId = searchParams.get("brandId") || "";
  const availability = searchParams.get("availability") || (searchParams.get("inStock") === "true" ? "in-stock" : "");
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const [products, setProducts] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [categoryDetails, setCategoryDetails] = useState(categoryData);
  const [brands, setBrands] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCategoriesTree(true), fetchBrandsPublic()])
      .then(([categories, brandRows]) => {
        if (!active) return;
        setCategoryTree(Array.isArray(categories) ? categories : []);
        setBrands(Array.isArray(brandRows) ? brandRows : []);
      })
      .catch(() => {
        if (!active) return;
        setCategoryTree([]);
        setBrands([]);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!category || (categoryData?.slug === category)) {
      setCategoryDetails(categoryData?.slug === category ? categoryData : null);
      return () => { active = false; };
    }
    fetchCategoryBySlug(category).then(value => { if (active) setCategoryDetails(value); }).catch(() => { if (active) setCategoryDetails(null); });
    return () => { active = false; };
  }, [category, categoryData]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchProductsPage({
      q: query || undefined,
      category: category || undefined,
      brand: brand || undefined,
      brandSlug: brandSlug || undefined,
      brandId: brandId || undefined,
      availability: availability || undefined,
      minPrice: minPrice === "" ? undefined : Number(minPrice),
      maxPrice: maxPrice === "" ? undefined : Number(maxPrice),
      sort,
      page,
      limit: PAGE_SIZE
    }).then(response => {
      if (!active) return;
      setProducts(response.products);
      setPagination(response.pagination);
    }).catch(() => {
      if (!active) return;
      setProducts([]);
      setPagination({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
      setError("تعذر تحميل المنتجات. تحقق من الاتصال ثم حاول مرة أخرى.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [availability, brand, brandId, brandSlug, category, maxPrice, minPrice, page, query, reloadKey, sort]);

  const activeCategory = categoryDetails || findCategory(categoryTree, category);
  const activeBrand = brandData || brands.find(item => item.id === brandId || item.slug === brandSlug || item.slug === brand);
  const fixedNode = findCategory(categoryTree, fixedCategory);
  const filterCategories = fixedNode ? (fixedNode.children?.length ? fixedNode.children : [fixedNode]) : categoryTree;
  const title = query ? `نتائج البحث عن «${query}»` : activeCategory ? activeCategory.name : activeBrand ? `منتجات ${activeBrand.name}` : "كل المنتجات";
  const total = Number(pagination.total || 0);
  const pageCount = Math.max(Number(pagination.totalPages || 1), 1);
  const currentPage = Math.min(Number(pagination.page || page), pageCount);
  const firstIndex = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastIndex = total ? Math.min(currentPage * PAGE_SIZE, total) : 0;

  const changeParams = changes => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === null || value === "") params.delete(key); else params.set(key, String(value));
    }
    if (!("page" in changes)) params.delete("page");
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const clearDiscovery = () => {
    const params = new URLSearchParams();
    if (sort !== "relevance") params.set("sort", sort);
    router.push(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  const chips = useMemo(() => {
    const values = [];
    if (query) values.push({ key: "q", label: `بحث: ${query}`, remove: { q: "" } });
    if (searchParams.get("category") && activeCategory) values.push({ key: "category", label: activeCategory.name, remove: { category: "" } });
    if ((searchParams.get("brand") || searchParams.get("brandSlug") || searchParams.get("brandId")) && activeBrand) values.push({ key: "brand", label: activeBrand.name, remove: { brand: "", brandSlug: "", brandId: "" } });
    if (availability) values.push({ key: "availability", label: availability === "in-stock" ? "متوفر" : "غير متوفر", remove: { availability: "", inStock: "" } });
    if (minPrice !== "") values.push({ key: "minPrice", label: `من ${minPrice} د.ل`, remove: { minPrice: "" } });
    if (maxPrice !== "") values.push({ key: "maxPrice", label: `إلى ${maxPrice} د.ل`, remove: { maxPrice: "" } });
    return values;
  }, [activeBrand, activeCategory, availability, maxPrice, minPrice, query, searchParams]);

  const filterProps = { categories: filterCategories, brands, fixedCategory };

  return <Box className="bg-white" sx={{ py: embedded ? 0 : { xs: 2, md: 4 } }}>
    <Container disableGutters={embedded}>
      {!embedded ? <>
        <Breadcrumbs sx={{ mb: 1.5 }} aria-label="مسار التصفح">
          <Link href="/">الرئيسية</Link>
          {(activeCategory?.breadcrumbs || []).map(ancestor => <Link key={ancestor.id} href={`/categories/${ancestor.slug}`}>{ancestor.name}</Link>)}
          <Typography color="text.primary">{title}</Typography>
        </Breadcrumbs>
        <Typography component="h1" variant="h4" fontWeight={900}>{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>{total} منتج</Typography>
      </> : null}

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Button startIcon={<FilterList />} variant="outlined" onClick={() => setMobileFiltersOpen(true)} sx={{ display: { md: "none" } }}>الفلاتر</Button>
            <Typography fontWeight={700}>{loading ? "جاري التحميل…" : `عرض ${firstIndex}-${lastIndex} من ${total}`}</Typography>
          </Stack>
          <TextField select size="small" label="ترتيب النتائج" value={sort} onChange={event => changeParams({ sort: event.target.value })} sx={{ minWidth: { xs: "100%", sm: 240 } }}>
            {SORT_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </Stack>
        {chips.length ? <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
          {chips.map(chip => <Chip key={chip.key} label={chip.label} onDelete={() => changeParams(chip.remove)} />)}
          <Button size="small" color="error" onClick={clearDiscovery}>مسح الكل</Button>
        </Stack> : null}
      </Paper>

      {loading ? <DiscoverySkeleton /> : error ? <Paper sx={{ py: 7, textAlign: "center" }}>
        <Typography fontWeight={700}>{error}</Typography>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => setReloadKey(value => value + 1)}>إعادة المحاولة</Button>
      </Paper> : <Grid container spacing={3}>
        <Grid size={{ md: 3 }} sx={{ display: { xs: "none", md: "block" } }}>
          <Paper variant="outlined" sx={{ position: "sticky", top: 110 }}><ProductFilters filters={filterProps} /></Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 9 }}>
          {products.length ? <ProductsGridView products={products} /> : <EmptyState type="search" title="لا توجد منتجات مطابقة"
            subtitle="غيّر الفلاتر أو كلمات البحث للوصول إلى نتائج أخرى." actionLabel="عرض كل المنتجات" actionHref="/products/search" />}
          {pageCount > 1 ? <Stack alignItems="center" sx={{ mt: 5 }}>
            <Pagination color="primary" variant="outlined" page={currentPage} count={pageCount}
              onChange={(_, nextPage) => changeParams({ page: nextPage })} />
          </Stack> : null}
        </Grid>
      </Grid>}
    </Container>

    <Drawer anchor="right" open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)}
      PaperProps={{ sx: { width: "min(92vw, 390px)" } }}>
      <Box sx={{ p: 1 }}><Button onClick={() => setMobileFiltersOpen(false)}>إغلاق</Button></Box>
      <ProductFilters filters={filterProps} onClose={() => setMobileFiltersOpen(false)} />
    </Drawer>
  </Box>;
}
