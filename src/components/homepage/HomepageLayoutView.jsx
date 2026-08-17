import Link from "next/link";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import SupportAgentOutlined from "@mui/icons-material/SupportAgentOutlined";
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
            <Link
              href={`/products/search?category=${encodeURIComponent(category.slug)}`}
              style={{ textDecoration: "none" }}
            >
              <Card
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
            </Link>
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
            <Link href={`/brands/${brand.slug}`} style={{ textDecoration: "none" }}>
              <Card
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
            </Link>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

function HeroBannerBlock({ block }) {
  const config = block.config || {};
  if (!config.imageUrl && !block.title) return null;
  const card = (
    <Card
      sx={{
        position: "relative",
        minHeight: { xs: 200, sm: 320 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        overflow: "hidden",
        bgcolor: config.imageUrl ? "transparent" : "primary.light",
        background: config.imageUrl ? undefined : undefined
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
          color: "common.white",
          textShadow: config.imageUrl ? "0 2px 12px rgba(0,0,0,0.5)" : "none",
          px: 3
        }}
      >
        {block.title ? <Typography variant="h2" fontWeight={700} fontSize={{ xs: 28, sm: 48 }}>{block.title}</Typography> : null}
        {block.subtitle ? <Typography variant="h6" mt={1}>{block.subtitle}</Typography> : null}
      </Box>
    </Card>
  );

  return (
    <Container sx={{ py: 3 }}>
      {config.href ? <Link href={config.href} style={{ textDecoration: "none" }}>{card}</Link> : card}
    </Container>
  );
}

function StoreTrustStrip() {
  const items = [
    [<LocalShippingOutlined key="shipping" />, "توصيل داخل ليبيا", "ننسق التوصيل معك"],
    [<PaymentsOutlined key="payment" />, "الدفع عند الاستلام", "خيارات دفع مناسبة"],
    [<VerifiedOutlined key="warranty" />, "منتجات بضمان", "بيانات واضحة لكل منتج"],
    [<SupportAgentOutlined key="support" />, "دعم قبل الشراء", "نساعدك في الاختيار"],
  ];
  return (
    <Container sx={{ pt: 2 }}>
      <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Grid container spacing={1}>
          {items.map(([icon, title, subtitle]) => (
            <Grid key={title} size={{ xs: 6, md: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 58 }}>
                <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
                  <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Paper>
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
      <StoreTrustStrip />
      {blocks.map(block => (
        <HomepageBlockRenderer key={block.id} block={block} />
      ))}
    </>
  );
}
