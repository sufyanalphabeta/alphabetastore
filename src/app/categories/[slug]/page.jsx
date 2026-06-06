import { notFound } from "next/navigation";

// UTILS
import { fetchCategoryBySlug, fetchProductsPage } from "utils/catalog";

// PAGE-SECTION
import CategoryPageView from "pages-sections/categories/page-view";

// SEO
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = await fetchCategoryBySlug(slug).catch(() => null);

  if (!category) {
    return {
      title: "Category Not Found",
      description: "This category does not exist.",
    };
  }

  return {
    title: `${category.name} | AlphaBeta Store`,
    description:
      category.description ||
      `Browse ${category.name} products at AlphaBeta Store. Find the best electronics and technology products at the best prices.`,
    openGraph: {
      title: `${category.name} | AlphaBeta Store`,
      description: category.description || `Browse ${category.name} products.`,
      images: category.imageUrl ? [{ url: category.imageUrl }] : [],
    },
    alternates: {
      canonical: `/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;

  const [category, productsResponse] = await Promise.all([
    fetchCategoryBySlug(slug).catch(() => null),
    fetchProductsPage({ category: slug, status: "ACTIVE", limit: 24 }).catch(() => null),
  ]);

  if (!category) {
    notFound();
  }

  const products = productsResponse?.products ?? [];
  const pagination = productsResponse?.pagination ?? { total: 0, totalPages: 1, page: 1, limit: 24 };

  return (
    <CategoryPageView
      category={category}
      products={products}
      pagination={pagination}
    />
  );
}
