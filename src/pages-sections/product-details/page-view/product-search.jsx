"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// MUI
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Pagination from "@mui/material/Pagination";
import Typography from "@mui/material/Typography";

// MUI ICON COMPONENTS
import Apps from "@mui/icons-material/Apps";
import ViewList from "@mui/icons-material/ViewList";
import FilterList from "@mui/icons-material/FilterList";

// GLOBAL CUSTOM COMPONENTS
import Sidenav from "components/side-nav";
import { FlexBetween, FlexBox } from "components/flex-box";
import ProductFilters from "components/products-view/filters";
import ProductsGridView from "components/products-view/products-grid-view";
import ProductsListView from "components/products-view/products-list-view";
import ProductCardSkeleton from "components/product-cards/ProductCardSkeleton";
import EmptyState from "components/empty-state/EmptyState";
import { buildProductFilters, fetchBrandsPublic, fetchCategories, fetchProductsPage, trackSearchTerm } from "utils/catalog";

// TYPES

const SORT_OPTIONS = [{
  label: "Relevance",
  value: "relevance"
}, {
  label: "Newest",
  value: "newest"
}, {
  label: "Price Low to High",
  value: "asc"
}, {
  label: "Price High to Low",
  value: "desc"
}];


// ==============================================================


// ==============================================================

const EMPTY_FILTERS = {
  brands: [],
  others: [],
  colors: [],
  categories: []
};

const PAGE_SIZE = 12;

export default function ProductSearchPageView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q");
  const page = searchParams.get("page") || "1";
  const view = searchParams.get("view") || "grid";
  const sort = searchParams.get("sort") || "relevance";
  const category = searchParams.get("category");
  const brand = searchParams.get("brand");
  const brandId = searchParams.get("brandId");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const inStock = searchParams.get("inStock") === "true";
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [allBrands, setAllBrands] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadFilters = async () => {
      try {
        const [categoriesResponse, brandsResponse] = await Promise.all([
          fetchCategories(),
          fetchBrandsPublic(),
        ]);

        if (!active) return;

        setFilters(buildProductFilters(categoriesResponse));
        setAllBrands(Array.isArray(brandsResponse) ? brandsResponse : []);
      } catch {
        if (!active) return;

        setFilters(EMPTY_FILTERS);
        setAllBrands([]);
      }
    };

    loadFilters();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const productsResponse = await fetchProductsPage({
          q: query,
          category,
          brand,
          brandId,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          inStock: inStock || undefined,
          sort,
          page: Number(page) || 1,
          limit: PAGE_SIZE
        });

        if (!active) return;

        setProducts(productsResponse.products);
        setPagination(productsResponse.pagination);

        // Track search term analytics (fire-and-forget)
        if (query && query.trim().length >= 2) {
          trackSearchTerm(query.trim()).catch(() => {});
        }
      } catch {
        if (!active) return;

        setProducts([]);
        setPagination({
          page: 1,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 1
        });
        setError("Failed to load products");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, [category, brand, brandId, inStock, minPrice, maxPrice, page, query, sort]);

  const handleChangeSearchParams = (key, value) => {
    if (!key || !value) return;
    const params = new URLSearchParams(searchParams);

    if (key !== "page") {
      params.delete("page");
    }

    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalProducts = Number(pagination.total || 0);
  const pageCount = Math.max(1, Number(pagination.totalPages || 1));
  const currentPage = Math.min(Number(pagination.page || page || 1), pageCount);
  const firstIndex = totalProducts ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastIndex = totalProducts ? Math.min(currentPage * PAGE_SIZE, totalProducts) : 0;

  if (loading) {
    return (
      <div className="bg-white pt-2 pb-4">
        <Container>
          <Grid container spacing={3}>
            <Grid size={{ xl: 2, md: 3 }} sx={{ display: { md: "block", xs: "none" } }}>
              {/* Sidebar skeleton */}
              <Box pt={1}>
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} variant="text" width="80%" height={32} animation="wave" sx={{ mb: 0.5 }} />
                ))}
              </Box>
            </Grid>
            <Grid size={{ xl: 10, md: 9, xs: 12 }}>
              <Grid container spacing={3}>
                {[1, 2, 3, 4, 5, 6].map(item => (
                  <Grid key={item} size={{ lg: 4, sm: 6, xs: 12 }}>
                    <ProductCardSkeleton />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </div>
    );
  }

  if (error) {
    return <div className="bg-white pt-2 pb-4">
        <Container>
          <Typography>تعذر تحميل المنتجات.</Typography>
        </Container>
      </div>;
  }

  return <div className="bg-white pt-2 pb-4">
      <Container>
        {/* FILTER ACTION AREA */}
        <FlexBetween flexWrap="wrap" gap={2} mb={2}>
          {query ? <div>
              <Typography variant="h5" sx={{
            mb: 0.5
          }}>
                نتائج البحث عن "{query}"
              </Typography>
              <Typography variant="body1" sx={{
            color: "grey.600"
          }}>
                تم العثور على {totalProducts} منتج
              </Typography>
            </div> : <div />}

          <FlexBox alignItems="center" columnGap={4} flexWrap="wrap">
            <FlexBox alignItems="center" gap={1} flex="1 1 0">
              <Typography variant="body1" sx={{
              color: "grey.600",
              whiteSpace: "pre"
            }}>
                ترتيب حسب:
              </Typography>

              <TextField select fullWidth size="small" value={sort} variant="outlined" placeholder="ترتيب حسب" onChange={e => handleChangeSearchParams("sort", e.target.value)} sx={{
              flex: "1 1 0",
              minWidth: "150px"
            }}>
                {SORT_OPTIONS.map(item => <MenuItem value={item.value} key={item.value}>
                    {item.label}
                  </MenuItem>)}
              </TextField>
            </FlexBox>

            <FlexBox alignItems="center" my="0.25rem">
              <Typography variant="body1" sx={{
              color: "grey.600",
              mr: 1
            }}>
                العرض:
              </Typography>

              <IconButton onClick={() => handleChangeSearchParams("view", "grid")}>
                <Apps fontSize="small" color={view === "grid" ? "primary" : "inherit"} />
              </IconButton>

              <IconButton onClick={() => handleChangeSearchParams("view", "list")}>
                <ViewList fontSize="small" color={view === "list" ? "primary" : "inherit"} />
              </IconButton>

              {/* SHOW IN THE SMALL DEVICE */}
              <Box display={{
              md: "none",
              xs: "block"
            }}>
                <Sidenav handler={close => <IconButton onClick={close}>
                      <FilterList fontSize="small" />
                    </IconButton>}>
                  <Box px={3} py={2}>
                    <ProductFilters filters={{ ...filters, brands: allBrands, inStock }} />
                  </Box>
                </Sidenav>
              </Box>
            </FlexBox>
          </FlexBox>
        </FlexBetween>

        <Grid container spacing={4}>
          {/* PRODUCT FILTER SIDEBAR AREA */}
          <Grid size={{
          xl: 2,
          md: 3
        }} sx={{
          display: {
            md: "block",
            xs: "none"
          }
        }}>
            <ProductFilters filters={{ ...filters, brands: allBrands, inStock }} />
          </Grid>

          {/* PRODUCT VIEW AREA */}
          <Grid size={{
          xl: 10,
          md: 9,
          xs: 12
        }}>
            {view === "grid" ? <ProductsGridView products={products} /> : <ProductsListView products={products} />}

            {!products.length ? (
              <EmptyState
                type="search"
                title="لا توجد منتجات مطابقة"
                subtitle="حاول تغيير الفلاتر أو كلمات البحث للعثور على ما تبحث عنه."
                actionLabel="تصفح كل المنتجات"
                actionHref="/products/search"
              />
            ) : null}

            <FlexBetween flexWrap="wrap" mt={6}>
              <Typography variant="body1" sx={{
              color: "grey.600"
            }}>
                عرض {firstIndex}-{lastIndex} من إجمالي {totalProducts} منتج
              </Typography>

              <Pagination color="primary" variant="outlined" page={currentPage} count={pageCount} onChange={(_, nextPage) => handleChangeSearchParams("page", nextPage.toString())} />
            </FlexBetween>
          </Grid>
        </Grid>
      </Container>
    </div>;
}
