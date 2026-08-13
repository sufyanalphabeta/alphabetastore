import { ProductReviewQueuePageView } from "pages-sections/vendor-dashboard/products/page-view";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "مراجعة المنتجات - Alphabeta Store",
  description: "مساحة مراجعة جودة وجاهزية كتالوج المنتجات."
};

export default function ProductReviewPage() {
  return <ProductReviewQueuePageView />;
}
