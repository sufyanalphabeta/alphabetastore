import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "مراجعة المنتجات - Alphabeta Store",
  description: "مساحة مراجعة جودة وجاهزية كتالوج المنتجات."
};

export default async function ProductReviewPage({ searchParams }) {
  const current = await searchParams;
  const params = new URLSearchParams();
  Object.entries(current || {}).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  if (!params.has("workspace")) params.set("workspace", "NEEDS_REVIEW");
  redirect(`/admin/products?${params.toString()}`);
}
