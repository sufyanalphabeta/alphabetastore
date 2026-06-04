import Link from "next/link";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import Container from "components/Container";
import LazyImage from "components/LazyImage";
import ProductCard1 from "components/product-cards/product-card-1";
import { mapCatalogProduct, normalizeProductImageUrl } from "utils/catalog";

function SectionHeading({ title, subtitle }) {
  if (!title && !subtitle) return null;
  return (
    <Stack spacing={0.5} mb={2}>
      {title ? (
        <Typography variant="h2" fontWeight={700} fontSize={{ xs: 24, sm: 32 }}>
          {title}
        </Typography>
      ) : null}
      {subtitle ? (
        <Typography variant="body1" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Stack>
  );
}

function ProductsBlock({ block }) {
  const items = Array.isArray(block.items) ? block.items : [];
  if (!items.length) return null;
  return (
    <Container sx={{ py: 4 }}>
      <SectionHeading title={block.title} subtitle={block.subtitle} />
      <Grid container spacing={3}>
        {items.map(product => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={product.id}>
            <ProductCard1 product={mapCatalogProduct(product)} />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

function FeaturedCategoriesBlock({ block }) {
  const items = Array.isArray(block.items) ? block.items : [];
  if (!items.length) return null;
  return (
    <Container sx={{ py: 4 }}>
      <SectionHeading title={block.title || "Featured Categories"} subtitle={block.subtitle} />
      <Grid container spacing={2}>
        {items.map(category => (
          <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={category.id}>
            <Card
              component={Link}
              href={`/products/search?category=${encodeURIComponent(category.slug)}`}
              sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textDecoration: "none",
                color: "text.primary",
                transition: "all 0.2s ease",
                ":hover": { boxShadow: 4, transform: "translateY(-2px)" }
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1
                }}
              >
                {category.imageUrl ? (
                  <LazyImage
                    src={normalizeProductImageUrl(category.imageUrl)}
                    alt={category.name}
                    width={80}
                    height={80}
                    style={{ objectFit: "contain" }}
                  />
                ) : (
                  <Typography variant="h3">{category.icon || category.name?.charAt(0)}</Typography>
                )}
              </Box>
              <Typography variant="subtitle2" fontWeight={600} textAlign="center">
                {category.name}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

function FeaturedBrandsBlock({ block }) {
  const items = Array.isArray(block.items) ? block.items : [];
  if (!items.length) return null;
  return (
    <Container sx={{ py: 4 }}>
      <SectionHeading title={block.title || "Featured Brands"} subtitle={block.subtitle} />
      <Grid container spacing={2}>
        {items.map(brand => (
          <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={brand.id}>
            <Card
              component={Link}
              href={`/brands/${brand.slug}`}
              sx={{
                p: 2,
                height: 110,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                color: "text.primary",
                transition: "all 0.2s ease",
                ":hover": { boxShadow: 4 }
              }}
            >
              {brand.logoUrl ? (
                <LazyImage
                  src={normalizeProductImageUrl(brand.logoUrl)}
                  alt={brand.name}
                  width={120}
                  height={60}
                  style={{ objectFit: "contain", maxWidth: "100%", maxHeight: 60 }}
                />
              ) : (
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {brand.name}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                {brand.name}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

function HeroBannerBlock({ block }) {
  const config = block.config || {};
  if (!config.imageUrl && !block.title) return null;
  return (
    <Container sx={{ py: 3 }}>
      <Card
        component={config.href ? Link : "div"}
        href={config.href || undefined}
        sx={{
          position: "relative",
          minHeight: { xs: 200, sm: 320 },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          overflow: "hidden",
          bgcolor: config.imageUrl ? "transparent" : "primary.light"
        }}
      >
        {config.imageUrl ? (
          <Box
            component="img"
            src={normalizeProductImageUrl(config.imageUrl)}
            alt={block.title || "banner"}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        ) : null}
        <Box
          sx={{
            position: "relative",
            textAlign: "center",
            color: config.imageUrl ? "common.white" : "text.primary",
            textShadow: config.imageUrl ? "0 2px 12px rgba(0,0,0,0.5)" : "none",
            px: 3
          }}
        >
          {block.title ? (
            <Typography variant="h2" fontWeight={700} fontSize={{ xs: 28, sm: 48 }}>
              {block.title}
            </Typography>
          ) : null}
          {block.subtitle ? (
            <Typography variant="h6" mt={1}>
              {block.subtitle}
            </Typography>
          ) : null}
        </Box>
      </Card>
    </Container>
  );
}

export function HomepageBlockRenderer({ block }) {
  switch (block.type) {
    case "HERO_BANNER":
      return <HeroBannerBlock block={block} />;
    case "FEATURED_CATEGORIES":
      return <FeaturedCategoriesBlock block={block} />;
    case "FEATURED_BRANDS":
      return <FeaturedBrandsBlock block={block} />;
    case "NEW_ARRIVALS":
    case "BEST_SELLERS":
    case "PROMOTIONS":
    case "RECENTLY_ADDED":
    case "CUSTOM_PRODUCTS":
      return <ProductsBlock block={block} />;
    default:
      return null;
  }
}

export default function HomepageLayoutView({ blocks = [] }) {
  if (!blocks.length) {
    return (
      <Container sx={{ py: 8 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography variant="h3" fontWeight={700}>
            Welcome to Alphabeta Store
          </Typography>
          <Typography color="text.secondary" maxWidth={520}>
            The homepage hasn&apos;t been configured yet. An administrator can build it from{" "}
            <Link href="/admin/homepage" style={{ textDecoration: "underline" }}>
              Homepage Blocks
            </Link>
            .
          </Typography>
        </Stack>
      </Container>
    );
  }

  return (
    <>
      {blocks.map(block => (
        <HomepageBlockRenderer key={block.id} block={block} />
      ))}
    </>
  );
}
