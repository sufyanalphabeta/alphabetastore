import BundlesPageView from "pages-sections/vendor-dashboard/bundles/page-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Product Bundles - AlphaBeta Admin",
};

export default function AdminBundlesPage() {
  return <BundlesPageView />;
}
