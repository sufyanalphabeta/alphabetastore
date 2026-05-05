import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";

// LOCAL CUSTOM COMPONENT
import Card from "./card";

// API FUNCTIONS
import api from "utils/__api__/market-1";

export default async function Section3() {
  const categories = await api.getCategories();
  if (!categories || categories.length === 0) return null;

  return (
    <Container>
      <Typography
        variant="h2"
        fontWeight={700}
        mb={0.75}
        fontSize={{ sm: 28, xs: 22 }}
      >
        تصفح الفئات
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        اكتشف مجموعتنا الواسعة من المنتجات التقنية
      </Typography>

      <Grid container spacing={1.5}>
        {categories.map(category => (
          <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={category.id}>
            <Card
              name={category.name}
              icon={category.icon}
              link={`/products/search?category=${category.slug}`}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
