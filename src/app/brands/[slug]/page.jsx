import Link from "next/link";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { ProductSearchPageView } from "pages-sections/product-details/page-view";

const API_BASE = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1";

async function getBrand(slug) {
  const response = await fetch(`${API_BASE}/brands/slug/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.success ? payload.data : payload;
}

export async function generateMetadata({ params }) {
  const brand = await getBrand((await params).slug);
  if (!brand) return { title: "العلامة غير موجودة | Alphabeta Store", robots: { index: false, follow: false } };
  return { title: `${brand.name} | Alphabeta Store`, description: brand.description || `منتجات ${brand.name} في متجر ألفابيتا` };
}

export default async function BrandLandingPage({ params }) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();

  return <Container sx={{ py: { xs: 2, md: 4 } }}>
    <Breadcrumbs sx={{ mb: 2 }} aria-label="مسار العلامة التجارية">
      <Link href="/">الرئيسية</Link>
      <Link href="/brands">العلامات التجارية</Link>
      <Typography color="text.primary">{brand.name}</Typography>
    </Breadcrumbs>

    <Paper sx={{ p: { xs: 2.5, md: 4 }, mb: 3, borderRadius: 3, overflow: "hidden", background: "linear-gradient(135deg, #16233c 0%, #315da5 100%)", color: "common.white" }}>
      {brand.bannerUrl ? <Box component="img" src={brand.bannerUrl} alt={brand.name} sx={{ width: "100%", maxHeight: 230, objectFit: "cover", borderRadius: 2, mb: 2 }} /> : null}
      <Typography component="h1" fontSize={{ xs: 28, md: 42 }} fontWeight={800}>{brand.name}</Typography>
      {brand.description ? <Typography sx={{ mt: 1, opacity: 0.88 }}>{brand.description}</Typography> : null}
      <Typography sx={{ mt: 1.5, opacity: 0.8 }}>تصفح المنتجات المنشورة من {brand.name}</Typography>
    </Paper>

    <ProductSearchPageView fixedBrandSlug={brand.slug} brandData={brand} embedded />
  </Container>;
}
