"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

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
  fetchRelatedProducts,
  fetchRecentlyViewed,
  recordProductView,
  fetchActiveBundles,
} from "utils/catalog";

function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem("ab_sid");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem("ab_sid", id);
    }
    return id;
  } catch {
    return null;
  }
}

export default function ProductDetailsPageView({ product }) {
  const [related, setRelated] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [bundles, setBundles] = useState([]);
  const viewedProductId = useRef(null);

  useEffect(() => {
    let active = true;
    setRelated([]);
    setRecentlyViewed([]);
    setBundles([]);
    if (!product?.id || viewedProductId.current === product.id) return () => { active = false; };

    viewedProductId.current = product.id;
    const sid = getSessionId();
    recordProductView(product.id, sid);
    Promise.all([
      fetchRelatedProducts(product.slug || product.id, 8),
      fetchRecentlyViewed(sid, 8),
      fetchActiveBundles(),
    ]).then(([rel, rv, bndl]) => {
      if (!active) return;
      setRelated(rel.filter(item => item.id !== product.id));
      setRecentlyViewed(rv.filter(item => item.id !== product.id));
      setBundles((bndl || []).filter(bundle =>
        bundle.items?.some(item => item.productId === product.id || item.product?.id === product.id)
      ));
    }).catch(() => {});

    return () => { active = false; };
  }, [product]);

  const categoryTrail = [
    ...(product.breadcrumbs || []),
    ...(product.category && !product.breadcrumbs?.some(item => item.id === product.category.id)
      ? [product.category]
      : [])
  ];

  return (
    <Container className="mt-2 mb-2">
      <Breadcrumbs aria-label="مسار المنتج" sx={{ mb: 2, fontSize: 14 }}>
        <Link href="/">الرئيسية</Link>
        {categoryTrail.map(item => (
          <Link key={item.id} href={`/categories/${item.slug}`}>{item.name}</Link>
        ))}
        <Typography color="text.primary" noWrap sx={{ maxWidth: { xs: 180, sm: 420 } }}>
          {product.title}
        </Typography>
      </Breadcrumbs>

      <ProductIntro product={product} />

      <ProductTabs
        reviewCount={product.ratingCount ?? 0}
        description={<ProductDescription description={product.description} />}
        descriptionText={product.description}
        reviews={<ProductReviews productId={product.id} />}
        qna={<ProductQnA productId={product.id} />}
        specs={product.specs}
        highlights={product.highlights}
        warrantyText={product.warrantyText}
        datasheetUrl={product.datasheetUrl}
      />

      <Divider sx={{ my: 6 }} />

      {product.relations?.FREQUENTLY_BOUGHT_TOGETHER?.length > 0 && (
        <FrequentlyBoughtTogether
          mainProduct={product}
          relatedProducts={product.relations.FREQUENTLY_BOUGHT_TOGETHER}
        />
      )}

      {product.relations?.ACCESSORY?.length > 0 && (
        <ProductAccessories accessories={product.relations.ACCESSORY} />
      )}

      {bundles.length > 0 && <ProductBundles bundles={bundles} />}

      {related.length > 0 && (
        <Box mt={6}><RelatedProducts products={related} /></Box>
      )}

      {recentlyViewed.length > 0 && (
        <Box mt={4}><RecentlyViewed products={recentlyViewed} /></Box>
      )}
    </Container>
  );
}
