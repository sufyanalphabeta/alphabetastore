
// PAGE VIEW COMPONENT
import { ProductSearchPageView } from "pages-sections/product-details/page-view";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const q = params?.q || "";
  const category = params?.category || "";
  const brand = params?.brand || "";

  let title = "Product Search - AlphaBeta Store";
  let description = "Search and discover electronics, networking, security, and more at AlphaBeta Store.";

  if (q) {
    title = `Search results for "${q}" - AlphaBeta Store`;
    description = `Showing search results for "${q}" — browse products, compare prices, and find the best electronics deals.`;
  } else if (category) {
    title = `${category} products - AlphaBeta Store`;
    description = `Browse ${category} products at AlphaBeta Store. Find the best prices on electronics in Libya.`;
  } else if (brand) {
    title = `${brand} products - AlphaBeta Store`;
    description = `Shop ${brand} products at AlphaBeta Store. Find the latest ${brand} electronics and technology.`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    ...(q ? { robots: { index: false } } : {}),
  };
}


// ==============================================================


// ==============================================================

export default async function ProductSearch({
  searchParams
}) {
  await searchParams;
  return <ProductSearchPageView />;
}
