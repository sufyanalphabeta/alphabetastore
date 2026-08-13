import { ProductReviewQueuePageView } from "pages-sections/vendor-dashboard/products/page-view";
export const metadata = {
  title: "Products - Alphabeta Store",
  description: `Alphabeta Store for the Libya market.`,
  authors: [{
    name: "Alphabeta Store",
    url: "https://alphabeta.com"
  }],
  keywords: ["e-commerce", "e-commerce template", "next.js", "react"]
};
export default function Products() {
  return <ProductReviewQueuePageView />;
}
