import Link from "next/link";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import ProductCard1 from "components/product-cards/product-card-1";
import { mapCatalogProduct, normalizeProductImageUrl } from "utils/catalog";

const API_BASE = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1";
const PAGE_SIZE = 24;

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.success ? payload.data : payload;
}

async function getCategory(slug) {
  return apiGet(`/categories/slug/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }) {
  const category = await getCategory((await params).slug);
  if (!category) return { title: "الفئة غير موجودة | Alphabeta Store", robots: { index: false, follow: false } };
  return {
    title: `${category.name} | Alphabeta Store`,
    description: category.description || `تصفح منتجات ${category.name} في متجر ألفابيتا`
  };
}

export default async function CategoryLandingPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const page = Math.max(Number(query?.page) || 1, 1);
  const category = await getCategory(slug);
  if (!category) notFound();

  const productData = await apiGet(
    `/products?category=${encodeURIComponent(slug)}&page=${page}&limit=${PAGE_SIZE}`
  );
  const products = Array.isArray(productData?.items) ? productData.items : [];
  const pagination = productData?.pagination || {
    page,
    limit: PAGE_SIZE,
    total: products.length,
    totalPages: 1
  };

  return <Container sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs sx={{ mb: 2 }} aria-label="مسار الفئة">
        <Link href="/">الرئيسية</Link>
        <Link href="/mobile-categories">الفئات</Link>
        {(category.breadcrumbs || []).map(ancestor => <Link key={ancestor.id} href={`/categories/${ancestor.slug}`}>
            {ancestor.name}
          </Link>)}
        <Typography color="text.primary">{category.name}</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: { xs: 2.5, md: 4 }, mb: 3, borderRadius: 3, background: "linear-gradient(135deg, #16233c 0%, #315da5 100%)", color: "common.white" }}>
        <Typography component="h1" fontSize={{ xs: 28, md: 42 }} fontWeight={800}>{category.name}</Typography>
        {category.description ? <Typography sx={{ mt: 1, maxWidth: 760, opacity: 0.88 }}>{category.description}</Typography> : null}
        <Typography sx={{ mt: 1.5, opacity: 0.8 }}>
          {category.productCount ?? pagination.total} منتج في هذه الفئة وفئاتها الفرعية
        </Typography>
      </Paper>

      {category.children?.length ? <Box component="section" sx={{ mb: 4 }}>
          <Typography component="h2" fontSize={{ xs: 22, md: 28 }} fontWeight={800} sx={{ mb: 2 }}>تصفح الأقسام الفرعية</Typography>
          <Grid container spacing={2}>
            {category.children.map(subcategory => <Grid key={subcategory.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                <Link href={`/categories/${subcategory.slug}`} style={{ textDecoration: "none" }}>
                  <Card sx={{ p: 1.5, height: "100%", textAlign: "center", border: "1px solid", borderColor: "divider", transition: "transform .2s, box-shadow .2s", "&:hover": { transform: "translateY(-3px)", boxShadow: 5 } }}>
                    <Box sx={{ height: 82, display: "grid", placeItems: "center", bgcolor: "grey.50", borderRadius: 2, mb: 1 }}>
                      {subcategory.imageUrl ? <Box component="img" src={normalizeProductImageUrl(subcategory.imageUrl)} alt={subcategory.name} sx={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Typography variant="h3" color="primary.main">{subcategory.name?.charAt(0)}</Typography>}
                    </Box>
                    <Typography fontWeight={700}>{subcategory.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{subcategory.productCount ?? 0} منتج</Typography>
                  </Card>
                </Link>
              </Grid>)}
          </Grid>
        </Box> : null}

      <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
        <Typography component="h2" fontSize={{ xs: 22, md: 28 }} fontWeight={800}>منتجات {category.name}</Typography>
        <Button href={`/products/search?category=${encodeURIComponent(category.slug)}`} variant="outlined">
          البحث والتصفية داخل الفئة
        </Button>
      </Stack>

      {products.length ? <Grid container spacing={2.5}>
          {products.map(item => <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <ProductCard1 product={mapCatalogProduct(item)} />
            </Grid>)}
        </Grid> : <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography fontWeight={700}>لا توجد منتجات منشورة في هذه الفئة حاليًا.</Typography>
          {category.children?.length ? <Typography color="text.secondary" sx={{ mt: 1 }}>يمكنك تصفح الأقسام الفرعية أعلاه.</Typography> : null}
        </Paper>}

      {pagination.totalPages > 1 ? <Stack direction="row" justifyContent="center" alignItems="center" gap={2} sx={{ mt: 4 }}>
          <Button href={`?page=${Math.max(page - 1, 1)}`} disabled={page <= 1}>السابق</Button>
          <Typography>{page} / {pagination.totalPages}</Typography>
          <Button href={`?page=${Math.min(page + 1, pagination.totalPages)}`} disabled={page >= pagination.totalPages}>التالي</Button>
        </Stack> : null}
    </Container>;
}
