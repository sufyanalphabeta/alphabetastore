import Link from "next/link";
import { notFound } from "next/navigation";

import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import ProductCard1 from "components/product-cards/product-card-1";
import { mapCatalogProduct, normalizeProductImageUrl } from "utils/catalog";

const API_BASE = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1";

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

async function getCategory(slug) {
  const payload = await apiGet(`/categories/slug/${encodeURIComponent(slug)}`);
  return payload?.success ? payload.data : null;
}

export async function generateMetadata({ params }) {
  const category = await getCategory((await params).slug);
  if (!category) return { title: "Category not found - Alphabeta Store", robots: { index: false, follow: false } };
  return { title: `${category.name} | Alphabeta Store`, description: category.description || `تصفح منتجات ${category.name} في متجر ألفابيتا` };
}

export default async function CategoryLandingPage({ params }) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const [productsPayload, categoriesPayload] = await Promise.all([
    apiGet(`/products?category=${encodeURIComponent(slug)}&limit=60`),
    apiGet("/categories?limit=200"),
  ]);
  const products = Array.isArray(productsPayload?.data?.items) ? productsPayload.data.items : [];
  const allCategories = Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : [];
  const subcategories = allCategories.filter(item => item?.parentId === category.id);

  return (
    <Container sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/">الرئيسية</Link>
        <Link href="/products/search">الأقسام</Link>
        <Typography color="text.primary">{category.name}</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: { xs: 2, md: 4 }, mb: 3, borderRadius: 3, background: "linear-gradient(135deg, #16233c 0%, #263d66 100%)", color: "common.white" }}>
        <Typography variant="h1" fontSize={{ xs: 28, md: 42 }} fontWeight={800}>{category.name}</Typography>
        {category.description ? <Typography sx={{ mt: 1, opacity: 0.85 }}>{category.description}</Typography> : null}
      </Paper>

      {subcategories.length ? <Box sx={{ mb: 4 }}>
        <Typography variant="h2" fontSize={{ xs: 22, md: 28 }} fontWeight={800} sx={{ mb: 2 }}>تصفح القسم</Typography>
        <Grid container spacing={2}>
          {subcategories.map(sub => <Grid key={sub.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
            <Link href={`/categories/${sub.slug}`} style={{ textDecoration: "none" }}>
              <Card sx={{ p: 2, textAlign: "center", height: "100%", transition: "all .2s", "&:hover": { transform: "translateY(-3px)", boxShadow: 5 } }}>
                <Box sx={{ height: 78, display: "grid", placeItems: "center", bgcolor: "grey.50", borderRadius: 2, mb: 1 }}>
                  {sub.imageUrl ? <Box component="img" src={normalizeProductImageUrl(sub.imageUrl)} alt={sub.name} sx={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Typography variant="h3" color="primary.main">{sub.name?.charAt(0)}</Typography>}
                </Box>
                <Typography fontWeight={700}>{sub.name}</Typography>
              </Card>
            </Link>
          </Grid>)}
        </Grid>
      </Box> : null}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h2" fontSize={{ xs: 22, md: 28 }} fontWeight={800}>منتجات القسم</Typography>
        <Typography color="text.secondary">{products.length} منتج</Typography>
      </Stack>
      {products.length ? <Grid container spacing={2.5}>
        {products.map(item => <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}><ProductCard1 product={mapCatalogProduct(item)} /></Grid>)}
      </Grid> : <Paper sx={{ p: 6, textAlign: "center" }}><Typography color="text.secondary">لا توجد منتجات في هذا القسم حالياً.</Typography></Paper>}
    </Container>
  );
}
