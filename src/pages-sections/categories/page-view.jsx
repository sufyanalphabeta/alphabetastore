import Link from "next/link";
import NextImage from "next/image";

// MUI
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import ProductCard1 from "components/product-cards/product-card-1";
import LazyImage from "components/LazyImage";
import { mapCatalogProduct } from "utils/catalog";

// =========================================================

export default function CategoryPageView({ category, products, pagination }) {
  if (!category) return null;

  const totalProducts = pagination?.total ?? products.length;

  return (
    <Box sx={{ bgcolor: "background.paper", pb: 6 }}>
      {/* Banner / Hero */}
      {category.imageUrl ? (
        <Box
          position="relative"
          width="100%"
          sx={{ height: { xs: 160, sm: 220, md: 280 }, overflow: "hidden" }}
        >
          <NextImage
            src={category.imageUrl}
            alt={category.name}
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
            priority
          />
          <Box
            position="absolute"
            inset={0}
            sx={{ background: "linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 70%)" }}
          />
          <Box
            position="absolute"
            bottom={0}
            left={0}
            p={{ xs: 2, md: 5 }}
          >
            <Typography
              variant="h2"
              fontWeight={700}
              color="white"
              fontSize={{ xs: 28, md: 42 }}
              sx={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
            >
              {category.name}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{ bgcolor: "primary.main", py: { xs: 5, md: 8 }, textAlign: "center" }}
        >
          <Typography
            variant="h2"
            fontWeight={700}
            color="primary.contrastText"
            fontSize={{ xs: 28, md: 42 }}
          >
            {category.name}
          </Typography>
        </Box>
      )}

      <Container sx={{ pt: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            Home
          </Link>
          <Link href="/products/search" style={{ textDecoration: "none", color: "inherit" }}>
            Products
          </Link>
          {category.parent ? (
            <Link
              href={`/categories/${category.parent.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {category.parent.name}
            </Link>
          ) : null}
          <Typography color="text.primary">{category.name}</Typography>
        </Breadcrumbs>

        {/* Description */}
        {category.description ? (
          <Typography
            variant="body1"
            color="text.secondary"
            maxWidth={800}
            mb={3}
          >
            {category.description}
          </Typography>
        ) : null}

        {/* Subcategory chips */}
        {category.children && category.children.length > 0 ? (
          <Box mb={4}>
            <Typography variant="h6" fontWeight={600} mb={1.5}>
              Subcategories
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {category.children.map((child) => (
                <Chip
                  key={child.id}
                  label={child.name}
                  component={Link}
                  href={`/categories/${child.slug}`}
                  clickable
                  variant="outlined"
                  sx={{ fontSize: 14 }}
                />
              ))}
            </Stack>
          </Box>
        ) : null}

        {/* Products heading */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" fontWeight={700}>
            Products
            {totalProducts > 0 ? (
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                ml={1}
              >
                ({totalProducts})
              </Typography>
            ) : null}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            component={Link}
            href={`/products/search?category=${category.slug}`}
          >
            View All
          </Button>
        </Box>

        {products.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Typography color="text.secondary">
              No products available in this category yet.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {products.map((product) => (
              <Grid
                key={product.id || product.slug}
                size={{ xs: 6, sm: 4, md: 3, xl: 2 }}
              >
                <ProductCard1 product={mapCatalogProduct(product)} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
