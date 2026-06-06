import RelationsPageView from "pages-sections/vendor-dashboard/relations/page-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Product Relations - AlphaBeta Admin",
};

export default function AdminRelationsPage() {
  return <RelationsPageView />;
}
