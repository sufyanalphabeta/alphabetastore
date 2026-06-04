import { BrandFormView } from "pages-sections/vendor-dashboard/brands/page-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Edit Brand - Alphabeta Store",
  description: "Edit brand details."
};

export default async function EditBrand({ params }) {
  const resolvedParams = await params;
  return <BrandFormView slug={resolvedParams.slug} />;
}
