import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import ProductCard1 from "components/product-cards/product-card-1";

// CUSTOM DATA MODEL


// ==============================================================


// ==============================================================

export default function RelatedProducts({
  products
}) {
  
// IF NO PRODUCTS RETURN NULL
  if (!products || !products.length) return null;
  return <div className="mb-4">
      <Typography variant="h3" sx={{ mb: 3 }}>
        منتجات مشابهة
      </Typography>

      <Grid container spacing={3}>
        {products.map(product => <Grid size={{
        lg: 3,
        md: 4,
        sm: 6,
        xs: 12
      }} key={product.id}>
            <ProductCard1 product={product} />
          </Grid>)}
      </Grid>
    </div>;
}