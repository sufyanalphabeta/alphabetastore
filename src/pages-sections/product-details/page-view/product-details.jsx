"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";

// LOCAL CUSTOM COMPONENTS
import ProductTabs from "../product-tabs";
import ProductIntro from "../product-intro";
import RelatedProducts from "../related-products";
import RecentlyViewed from "../recently-viewed";
import ProductDescription from "../product-description";
import ProductReviews from "../reviews/ProductReviews";
import ProductQnA from "../qna/ProductQnA";
import FrequentlyBoughtTogether from "../FrequentlyBoughtTogether";
import ProductAccessories from "../ProductAccessories";
import ProductBundles from "../ProductBundles";
import {
  fetchProductBySlug,
  fetchRelatedProducts,
  fetchRecentlyViewed,
  recordProductView,
  fetchActiveBundles,
} from "utils/catalog";

// Session ID helper (stored in sessionStorage so it persists across PDP visits)
function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem("ab_sid");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem("ab_sid", id);
    }
    return id;
  } catch { return null; }
}

// ==============================================================

export default function ProductDetailsPageView({ slug }) {
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const viewRecorded = useRef(false);

  useEffect(() => {
    let active = true;
    viewRecorded.current = false;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetchProductBySlug(slug);
        if (!active) return;

        setProduct(response);

        // Record this view (fire-and-forget)
        if (!viewRecorded.current && response?.id) {
          viewRecorded.current = true;
          const sid = getSessionId();
          recordProductView(response.id, sid);

          // Parallel: related + recently viewed + bundles
          Promise.all([
            fetchRelatedProducts(response.slug || response.id, 8),
            fetchRecentlyViewed(sid, 8),
            fetchActiveBundles(),
          ]).then(([rel, rv, bndl]) => {
            if (!active) return;
            setRelated(rel.filter(p => p.id !== response.id));
            setRecentlyViewed(rv.filter(p => p.id !== response.id));
            // Filter bundles to only those containing this product
            setBundles((bndl || []).filter(b =>
              b.items?.some(item => item.productId === response.id || item.product?.id === response.id)
            ));
          }).catch(() => {});
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
          <Grid size={{ md: 6, xs: 12 }}>
            <Skeleton variant="rounded" height={400} animation="wave" />
            <Box display="flex" gap={1} mt={1.5}>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} variant="rounded" width={72} height={72} animation="wave" />
              ))}
            </Box>
          </Grid>
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
        <Typography color="text.secondary">Failed to load product.</Typography>
      </Container>
    );
  }

  return (
    <Container className="mt-2 mb-2">
      {/* PRODUCT DETAILS INFO AREA */}
      <ProductIntro product={product} />

      {/* DESCRIPTION / SPECS / REVIEWS / Q&A TABS */}
      <ProductTabs
        reviewCount={product.ratingCount ?? 0}
        description={<ProductDescription description={product.description} />}
        reviews={<ProductReviews productId={product.id} />}
        qna={<ProductQnA productId={product.id} />}
        specs={product.specs}
      />

      <Divider sx={{ my: 6 }} />

      {/* FREQUENTLY BOUGHT TOGETHER */}
      {product.relations?.FREQUENTLY_BOUGHT_TOGETHER?.length > 0 && (
        <FrequentlyBoughtTogether
          mainProduct={product}
          relatedProducts={product.relations.FREQUENTLY_BOUGHT_TOGETHER}
        />
      )}

      {/* ACCESSORIES */}
      {product.relations?.ACCESSORY?.length > 0 && (
        <ProductAccessories accessories={product.relations.ACCESSORY} />
      )}

      {/* BUNDLES */}
      {bundles.length > 0 && (
        <ProductBundles bundles={bundles} />
      )}

      {/* RELATED PRODUCTS */}
      {related.length > 0 && (
        <Box mt={6}>
          <RelatedProducts products={related} />
        </Box>
      )}

      {/* RECENTLY VIEWED */}
      {recentlyViewed.length > 0 && (
        <Box mt={4}>
          <RecentlyViewed products={recentlyViewed} />
        </Box>
      )}
    </Container>
  );
}
