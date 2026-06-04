import Link from "next/link";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import PageWrapper from "../page-wrapper";
import {
  fetchBrandsPublic,
  fetchCategoriesTree,
  fetchHomepageLayout,
  fetchProductsPage
} from "utils/catalog";

function flattenCategoryTree(nodes, parentPath = []) {
  const out = [];
  for (const node of nodes || []) {
    const path = [...parentPath, node.name];
    out.push({ id: node.id, slug: node.slug, name: node.name, path });
    if (Array.isArray(node.children) && node.children.length) {
      out.push(...flattenCategoryTree(node.children, path));
    }
  }
  return out;
}

async function safeCount(filters) {
  try {
    const res = await fetchProductsPage({ ...filters, limit: 1, page: 1 });
    return res?.pagination?.total ?? (Array.isArray(res?.data) ? res.data.length : 0);
  } catch {
    return null;
  }
}

export default async function CatalogVerificationView() {
  const [tree, brands, layout] = await Promise.all([
    fetchCategoriesTree(false).catch(() => []),
    fetchBrandsPublic({ onlyVisible: false }).catch(() => []),
    fetchHomepageLayout().catch(() => [])
  ]);

  const categories = flattenCategoryTree(tree);
  const totalProducts = await safeCount({});
  const featuredCount = await safeCount({ featured: true });
  const newArrivalsCount = await safeCount({ sortBy: "newest" });

  const categoryCounts = await Promise.all(
    categories.slice(0, 50).map(async cat => ({
      ...cat,
      count: await safeCount({ category: cat.slug })
    }))
  );

  return (
    <PageWrapper title="Catalog Verification">
      <Stack spacing={3}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card><CardContent>
              <Typography variant="overline" color="text.secondary">Total products</Typography>
              <Typography variant="h3" fontWeight={700}>{totalProducts ?? "—"}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card><CardContent>
              <Typography variant="overline" color="text.secondary">Featured</Typography>
              <Typography variant="h3" fontWeight={700}>{featuredCount ?? "—"}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card><CardContent>
              <Typography variant="overline" color="text.secondary">Categories</Typography>
              <Typography variant="h3" fontWeight={700}>{categories.length}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card><CardContent>
              <Typography variant="overline" color="text.secondary">Brands</Typography>
              <Typography variant="h3" fontWeight={700}>{brands.length}</Typography>
            </CardContent></Card>
          </Grid>
        </Grid>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>Homepage blocks</Typography>
            {layout.length === 0 ? (
              <Typography color="text.secondary">
                No active homepage blocks. Configure them in{" "}
                <Link href="/admin/homepage">Homepage</Link>.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {layout.map(b => (
                  <Box key={b.id} display="flex" alignItems="center" gap={2}>
                    <Chip label={b.type} size="small" color="primary" variant="outlined" />
                    <Typography variant="body2" sx={{ flex: 1 }}>{b.title || "(untitled)"}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Array.isArray(b.items) ? b.items.length : 0} items
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>Products per category</Typography>
            <Grid container spacing={1}>
              {categoryCounts.map(cat => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cat.id}>
                  <Box
                    component={Link}
                    href={`/products/search?category=${cat.slug}`}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      textDecoration: "none",
                      color: "text.primary",
                      ":hover": { bgcolor: "action.hover" }
                    }}
                  >
                    <Typography variant="body2" noWrap title={cat.path.join(" / ")}>
                      {cat.path.join(" / ")}
                    </Typography>
                    <Chip
                      label={cat.count ?? "—"}
                      size="small"
                      color={cat.count ? "success" : "default"}
                      variant={cat.count ? "filled" : "outlined"}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>Products per brand</Typography>
            <Grid container spacing={1}>
              {brands.map(brand => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={brand.id}>
                  <Box
                    component={Link}
                    href={`/brands/${brand.slug}`}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      textDecoration: "none",
                      color: "text.primary",
                      ":hover": { bgcolor: "action.hover" }
                    }}
                  >
                    <Typography variant="body2" noWrap>{brand.name}</Typography>
                    <Chip
                      label={brand.productCount ?? 0}
                      size="small"
                      color={brand.productCount ? "success" : "default"}
                      variant={brand.productCount ? "filled" : "outlined"}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary">
          New arrivals total: {newArrivalsCount ?? "—"} · Verified live against backend
          /products, /categories/tree, /brands and /homepage/layout.
        </Typography>
      </Stack>
    </PageWrapper>
  );
}
