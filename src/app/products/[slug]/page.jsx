// PAGE VIEW COMPONENT
import { ProductDetailsPageView } from "pages-sections/product-details/page-view";
import { fetchProductBySlug } from "utils/catalog";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const product = await fetchProductBySlug(slug);
    const title = product?.title || product?.name || slug;
    const description = product?.shortDescription || product?.description?.slice(0, 160) || "Alphabeta Store";
    const image = product?.thumbnail || null;
    const brand = product?.brandRef?.name || product?.brand || null;

    return {
      title: `${title}${brand ? ` — ${brand}` : ""} | Alphabeta Store`,
      description,
      openGraph: {
        title,
        description,
        ...(image ? { images: [{ url: image }] } : {})
      },
      other: product?.sku ? { "product:retailer_item_id": product.sku } : {}
    };
  } catch {
    return { title: `${slug} | Alphabeta Store` };
  }
}

export default async function ProductDetails({ params }) {
  const { slug } = await params;
  return <ProductDetailsPageView slug={slug} />;
}
