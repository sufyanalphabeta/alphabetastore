import Link from "next/link";
import { notFound } from "next/navigation";

import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import ProductCard1 from "components/product-cards/product-card-1";
import { mapCatalogProduct } from "utils/catalog";

const API_BASE = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1";

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

async function getBrand(slug) {
  const payload = await apiGet(`/brands/slug/${encodeURIComponent(slug)}`);
  return payload?.success ? payload.data : null;
}

async function getBrandProducts(slug, searchParams) {
  const params = new URLSearchParams({ brandSlug: slug, limit: "60" });
  if (searchParams?.minPrice) params.set("minPrice", searchParams.minPrice);
  if (searchParams?.maxPrice) params.set("maxPrice", searchParams.maxPrice);
  if (searchParams?.inStock === "1" || searchParams?.inStock === "true") params.set("inStock", "true");
  const payload = await apiGet(`/products?${params.toString()}`);
  const data = payload?.data;
  return { items: Array.isArray(data?.items) ? data.items : [], total: Number(data?.pagination?.total || 0) };
}

export async function generateMetadata({ params }) {
  const brand = await getBrand((await params).slug);
  if (!brand) return { title: "Brand not found - Alphabeta Store", robots: { index: false, follow: false } };
  return { title: `${brand.name} - Alphabeta Store`, description: brand.description || `منتجات ${brand.name} في متجر ألفابيتا` };
}

export default async function BrandLandingPage({ params, searchParams }) {
  const { slug } = await params;
  const query = (await searchParams) || {};
  const brand = await getBrand(slug);
  if (!brand) notFound();
  const { items, total } = await getBrandProducts(slug, query);

  return (
    <Container sx={{ py: { xs: 2, md: 4 } }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/">الرئيسية</Link>
        <Link href="/brands">العلامات التجارية</Link>
        <Typography color="text.primary">{brand.name}</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: { xs: 2, md: 4 }, mb: 3, borderRadius: 3, overflow: "hidden", background: "linear-gradient(135deg, #16233c 0%, #263d66 100%)", color: "common.white" }}>
        {brand.bannerUrl ? <Box component="img" src={brand.bannerUrl} alt={`${brand.name} banner`} sx={{ width: "100%", maxHeight: 230, objectFit: "cover", borderRadius: 2, mb: 2 }} /> : null}
        <Typography variant="h1" fontSize={{ xs: 28, md: 42 }} fontWeight={800}>{brand.name}</Typography>
        {brand.description ? <Typography sx={{ mt: 1, opacity: 0.85 }}>{brand.description}</Typography> : null}
        <Typography sx={{ mt: 1, color: "#ffd08a" }}>{total} منتج متوفر</Typography>
      </Paper>

      <Paper component="form" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <TextField name="minPrice" type="number" size="small" label="السعر من (د.ل)" defaultValue={query.minPrice || ""} inputProps={{ min: 0 }} />
          <TextField name="maxPrice" type="number" size="small" label="السعر إلى (د.ل)" defaultValue={query.maxPrice || ""} inputProps={{ min: 0 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="inStock" value="1" defaultChecked={query.inStock === "1" || query.inStock === "true"} />
            متوفر فقط
          </label>
          <Button type="submit" variant="contained">تطبيق الفلاتر</Button>
        </Stack>
      </Paper>

      {items.length ? (
        <Grid container spacing={2.5}>
          {items.map(item => <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}><ProductCard1 product={mapCatalogProduct(item)} /></Grid>)}
        </Grid>
      ) : <Paper sx={{ p: 6, textAlign: "center" }}><Typography color="text.secondary">لا توجد منتجات مطابقة لهذه العلامة أو الفلاتر.</Typography></Paper>}
    </Container>
  );
}
