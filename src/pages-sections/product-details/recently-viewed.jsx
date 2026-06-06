import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import ProductCard1 from "components/product-cards/product-card-1";

export default function RecentlyViewed({ products }) {
  if (!products || !products.length) return null;

  return (
    <div className="mb-4">
      <Typography variant="h3" sx={{ mb: 3 }}>
        Recently Viewed
      </Typography>

      <Grid container spacing={3}>
        {products.map(product => (
          <Grid size={{ lg: 3, md: 4, sm: 6, xs: 12 }} key={product.id}>
            <ProductCard1 product={product} />
          </Grid>
        ))}
      </Grid>
    </div>
  );
}
