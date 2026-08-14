import { cache } from "react";
import { notFound } from "next/navigation";

import { ProductDetailsPageView } from "pages-sections/product-details/page-view";
import { fetchProductBySlug } from "utils/catalog";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3010").replace(/\/$/, "");
const getProduct = cache(slug => fetchProductBySlug(slug));

function absoluteUrl(path) {
  try {
    return new URL(path || "/", `${SITE_URL}/`).toString();
  } catch {
    return SITE_URL;
  }
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const product = await getProduct(slug);
    const title = product?.title || product?.name || slug;
    const description = product?.shortDescription || product?.description?.slice(0, 160) || "Alphabeta Store";
    const image = product?.thumbnail || null;
    const brand = product?.brandRef?.name || product?.brand || null;
    const productUrl = absoluteUrl(`/products/${product.slug || slug}`);

    return {
      title: `${title}${brand ? ` — ${brand}` : ""} | Alphabeta Store`,
      description,
      alternates: { canonical: productUrl },
      openGraph: {
        title,
        description,
        url: productUrl,
        type: "website",
        ...(image ? { images: [{ url: absoluteUrl(image), alt: title }] } : {})
      },
      other: product?.sku ? { "product:retailer_item_id": product.sku } : {}
    };
  } catch {
    return { title: `${slug} | Alphabeta Store` };
  }
}

export default async function ProductDetails({ params }) {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (/not found/i.test(error instanceof Error ? error.message : "")) notFound();
    throw error;
  }

  const categoryTrail = [
    ...(product.breadcrumbs || []),
    ...(product.category && !product.breadcrumbs?.some(item => item.id === product.category.id)
      ? [product.category]
      : [])
  ];
  const productUrl = absoluteUrl(`/products/${product.slug}`);
  const productStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription || product.description || undefined,
    image: product.gallery?.map(item => absoluteUrl(item.productUrl)).filter(Boolean),
    sku: product.sku || undefined,
    brand: product.brandRef?.name || product.brand
      ? { "@type": "Brand", name: product.brandRef?.name || product.brand }
      : undefined,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "LYD",
      price: String(product.storefrontPrice?.finalPrice ?? product.price),
      availability: product.availableStock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock"
    }
  };
  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: absoluteUrl("/") },
      ...categoryTrail.map((item, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: item.name,
        item: absoluteUrl(`/categories/${item.slug}`)
      })),
      {
        "@type": "ListItem",
        position: categoryTrail.length + 2,
        name: product.title,
        item: productUrl
      }
    ]
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productStructuredData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbStructuredData) }} />
    <ProductDetailsPageView product={product} />
  </>;
}
