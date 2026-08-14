import { ProductSearchPageView } from "pages-sections/product-details/page-view";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const q = params?.q || "";
  const category = params?.category || "";
  const brand = params?.brand || params?.brandSlug || "";
  let title = "كل المنتجات | Alphabeta Store";
  let description = "تصفح منتجات الإلكترونيات والكمبيوتر والشبكات في متجر ألفابيتا ليبيا.";

  if (q) {
    title = `نتائج البحث عن ${q} | Alphabeta Store`;
    description = `نتائج البحث عن ${q} في متجر ألفابيتا.`;
  } else if (category) {
    title = `${category} | Alphabeta Store`;
    description = `تصفح منتجات فئة ${category} في متجر ألفابيتا.`;
  } else if (brand) {
    title = `${brand} | Alphabeta Store`;
    description = `تصفح منتجات ${brand} في متجر ألفابيتا.`;
  }

  return { title, description, openGraph: { title, description }, ...(q ? { robots: { index: false } } : {}) };
}

export default async function ProductSearch({ searchParams }) {
  await searchParams;
  return <ProductSearchPageView />;
}
