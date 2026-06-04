import Link from "next/link";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import LazyImage from "components/LazyImage";
import { fetchBrandsPublic } from "utils/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Brands - Alphabeta Store",
  description: "Browse all product brands on Alphabeta Store."
};

export default async function BrandsIndex() {
  let brands = [];
  let loadError = "";
  try {
    brands = await fetchBrandsPublic({ onlyVisible: true });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load brands";
  }

  return (
    <Container sx={{ py: 6 }}>
      <Stack spacing={1} mb={4}>
        <Typography variant="h2" fontWeight={700} fontSize={{ xs: 28, sm: 36 }}>
          Brands
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {loadError ? loadError : `Browse ${brands.length} brand${brands.length === 1 ? "" : "s"}.`}
        </Typography>
      </Stack>

      {brands.length === 0 && !loadError ? (
        <Typography color="text.secondary">No brands available yet.</Typography>
      ) : null}

      <Grid container spacing={3}>
        {brands.map(brand => (
          <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={brand.id}>
            <Card
              component={Link}
              href={`/brands/${brand.slug}`}
              sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textDecoration: "none",
                color: "text.primary",
                height: "100%",
                transition: "all 0.2s ease",
                ":hover": { boxShadow: 4, transform: "translateY(-2px)" }
              }}
            >
              <Box
                position="relative"
                sx={{
                  width: "100%",
                  height: 80,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1.5
                }}
              >
                {brand.logoUrl ? (
                  <LazyImage
                    src={brand.logoUrl}
                    alt={brand.name}
                    width={120}
                    height={80}
                    style={{ objectFit: "contain", maxWidth: "100%", maxHeight: "100%" }}
                  />
                ) : (
                  <Typography variant="h4" fontWeight={700} color="primary.main">
                    {brand.name?.charAt(0)?.toUpperCase()}
                  </Typography>
                )}
              </Box>
              <Typography variant="subtitle1" fontWeight={600} textAlign="center">
                {brand.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {brand.productCount ?? 0} product{brand.productCount === 1 ? "" : "s"}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
