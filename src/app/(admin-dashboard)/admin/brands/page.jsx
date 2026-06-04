import { BrandsAdminPageView } from "pages-sections/vendor-dashboard/brands/page-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Brands - Alphabeta Store",
  description: "Manage product brands."
};

export default function BrandsAdmin() {
  return <BrandsAdminPageView />;
}
