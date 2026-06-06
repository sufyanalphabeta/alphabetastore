import Link from "next/link";
import NextImage from "next/image";
import { notFound } from "next/navigation";

import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import LazyImage from "components/LazyImage";
import ProductCard1 from "components/product-cards/product-card-1";
import { fetchBrandBySlugPublic, fetchProducts, mapCatalogProduct } from "utils/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const brand = await fetchBrandBySlugPublic(slug);
    if (!brand?.id) return { title: "Brand - Alphabeta Store" };
    return {
      title: brand.metaTitle || `${brand.name} - Alphabeta Store`,
      description:
        brand.metaDesc ||
        brand.description ||
        `Shop ${brand.name} products on Alphabeta Store.`,
      openGraph: {
        title: brand.metaTitle || `${brand.name} - Alphabeta Store`,
        description: brand.metaDesc || brand.description || `Shop ${brand.name} products.`,
        images: brand.bannerUrl
          ? [{ url: brand.bannerUrl }]
          : brand.logoUrl
          ? [{ url: brand.logoUrl }]
          : [],
      },
      alternates: { canonical: `/brands/${slug}` },
    };
  } catch {
    return { title: "Brand - Alphabeta Store" };
  }
}

export default async function BrandDetailPage({ params }) {
  const { slug } = await params;
  let brand = null;
  try {
    brand = await fetchBrandBySlugPublic(slug);
  } catch {
    brand = null;
  }
  if (!brand?.id) {
    notFound();
  }

  let products = [];
  try {
    products = await fetchProducts({ brandSlug: slug, limit: 24, noStore: true });
  } catch {
    products = [];
  }

  return (
    <Box sx={{ bgcolor: "background.paper", pb: 6 }}>
      {/* Banner */}
      {brand.bannerUrl ? (
        <Box
          position="relative"
          width="100%"
          sx={{ height: { xs: 180, sm: 240, md: 300 }, overflow: "hidden" }}
        >
          <NextImage
            src={brand.bannerUrl}
            alt={`${brand.name} banner`}
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
            priority
          />
          <Box
            position="absolute"
            inset={0}
            sx={{ background: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, transparent 60%)" }}
          />
        </Box>
      ) : null}

      <Container sx={{ pt: brand.bannerUrl ? 3 : 6 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>Home</Link>
          <Link href="/brands" style={{ textDecoration: "none", color: "inherit" }}>Brands</Link>
          <Typography color="text.primary">{brand.name}</Typography>
        </Breadcrumbs>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          alignItems={{ xs: "flex-start", sm: "center" }}
          mb={4}
          p={3}
          sx={{ bgcolor: "grey.100", borderRadius: 2 }}
        >
          <Box
            sx={{
              width: 120,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "background.paper",
              borderRadius: 2,
              p: 2,
              flexShrink: 0
            }}
          >
            {brand.logoUrl ? (
              <LazyImage
                src={brand.logoUrl}
                alt={brand.name}
                width={120}
                height={100}
                style={{ objectFit: "contain", maxWidth: "100%", maxHeight: "100%" }}
              />
            ) : (
              <Typography variant="h2" fontWeight={700} color="primary.main">
                {brand.name?.charAt(0)?.toUpperCase()}
              </Typography>
            )}
          </Box>
          <Stack spacing={1} flex={1}>
            <Typography variant="h2" fontWeight={700} fontSize={{ xs: 28, sm: 36 }}>
              {brand.name}
            </Typography>
            {brand.description ? (
              <Typography variant="body1" color="text.secondary">
                {brand.description}
              </Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              {products.length} product{products.length === 1 ? "" : "s"} available
            </Typography>
          </Stack>
        </Stack>

        {products.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Typography color="text.secondary">No products available for this brand yet.</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {products.map(product => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={product.id || product.slug}>
                <ProductCard1 product={mapCatalogProduct(product)} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
