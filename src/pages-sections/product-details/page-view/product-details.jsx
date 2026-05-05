"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";

// LOCAL CUSTOM COMPONENTS
import ProductTabs from "../product-tabs";
import ProductIntro from "../product-intro";
import RelatedProducts from "../related-products";
import ProductDescription from "../product-description";
import { fetchProductBySlug, fetchProducts } from "utils/catalog";

// ==============================================================
// ==============================================================

export default function ProductDetailsPageView({ slug }) {
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetchProductBySlug(slug);

        if (!active) return;

        setProduct(response);

        // Load related products from the same category (exclude this product)
        if (response?.categories?.length > 0) {
          fetchProducts({ category: response.categories[0], limit: 4 })
            .then(all => {
              if (!active) return;
              setRelatedProducts(all.filter(p => p.id !== response.id).slice(0, 4));
            })
            .catch(() => {});
        }
      } catch {
        if (!active) return;
        setProduct(null);
        setError("Failed to load product");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProduct();
    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return (
      <Container className="mt-2 mb-2">
        <Grid container spacing={3}>
          {/* Left: image skeleton */}
          <Grid size={{ md: 6, xs: 12 }}>
            <Skeleton variant="rounded" height={400} animation="wave" />
            <Box display="flex" gap={1} mt={1.5}>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} variant="rounded" width={72} height={72} animation="wave" />
              ))}
            </Box>
          </Grid>
          {/* Right: info skeleton */}
          <Grid size={{ md: 6, xs: 12 }}>
            <Skeleton variant="text" width="80%" height={40} animation="wave" />
            <Skeleton variant="text" width="40%" height={28} animation="wave" sx={{ mt: 1 }} />
            <Skeleton variant="text" width="60%" height={28} animation="wave" />
            <Skeleton variant="rounded" height={44} animation="wave" sx={{ mt: 3, maxWidth: 200 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container className="mt-2 mb-2">
        <Typography color="text.secondary">تعذر تحميل المنتج.</Typography>
      </Container>
    );
  }

  return (
    <Container className="mt-2 mb-2">
      {/* PRODUCT DETAILS INFO AREA */}
      <ProductIntro product={product} />

      {/* PRODUCT DESCRIPTION AND REVIEW */}
      <ProductTabs
        reviewCount={0}
        description={<ProductDescription description={product.description} />}
        reviews={<Typography color="text.secondary">No reviews available.</Typography>}
        specs={product.specs}
      />

      {/* RELATED PRODUCTS */}
      {relatedProducts.length > 0 && (
        <Box mt={6}>
          <RelatedProducts products={relatedProducts} />
        </Box>
      )}
    </Container>
  );
}
