import { cache } from "react";
import { FALLBACK_PRODUCT_IMAGE, fetchCategories, fetchProducts } from "utils/catalog";

function getActiveCategories(categories) {
  return (Array.isArray(categories) ? categories : []).filter(item => item?.isActive !== false);
}

function toCategoryLink(slug) {
  return `/products/search?category=${encodeURIComponent(slug)}`;
}

const getMainCarousel = cache(async () => {
  const products = await fetchProducts();
  return products.slice(0, 4).map(item => ({
    id: item.id,
    title: item.title || item.name,
    description: item.shortDescription || item.description || "اكتشف أحدث الوافدين وأفضل العروض اليومية",
    imgUrl: item.thumbnail || FALLBACK_PRODUCT_IMAGE,
    buttonText: "تسوق الآن",
    buttonLink: `/products/${item.slug}`
  }));
});

const getFlashDeals = cache(async () => {
  const products = await fetchProducts();
  return products.slice(0, 12);
});

const getCategories = cache(async () => {
  const categories = getActiveCategories(await fetchCategories(true));
  // Only top-level (parent) categories, sorted by sortOrder
  const topLevel = categories
    .filter(item => !item.parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 8);
  return topLevel.map(item => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    icon: item.icon || null,
    href: toCategoryLink(item.slug)
  }));
});

const getBestSellers = cache(async () => {
  const products = await fetchProducts();
  return products.slice(0, 8);
});

const getJustForYou = cache(async () => {
  const products = await fetchProducts();
  return products.slice(0, 8);
});

const getNewArrivalList = cache(async () => {
  const products = await fetchProducts();
  return products.slice(24, 36);
});

const getShops = cache(async () => {
  const categories = getActiveCategories(await fetchCategories());
  return categories.slice(0, 6).map(item => ({
    id: item.id,
    name: `${item.name} Store`,
    slug: item.slug,
    profilePicture: "/assets/images/faces/7.png"
  }));
});

const getProducts = cache(async () => {
  const products = await fetchProducts();
  return products.slice(0, 12);
});

const getBlogs = cache(async () => {
  const products = await fetchProducts();
  return products.slice(0, 3).map(item => ({
    id: item.id,
    title: item.title || item.name,
    createdAt: item.createdAt || "Latest",
    thumbnail: item.thumbnail || FALLBACK_PRODUCT_IMAGE,
    description: item.shortDescription || item.description || "Read practical shopping and product tips"
  }));
});

const getServiceList = cache(async () => {
  return [{
    id: "service-shipping",
    icon: "Truck",
    title: "Worldwide Delivery"
  }, {
    id: "service-return",
    icon: "Feedback",
    title: "30 Days Return"
  }, {
    id: "service-payment",
    icon: "CreditCard",
    title: "Secure Payment"
  }, {
    id: "service-support",
    icon: "CustomerService",
    title: "24/7 Support"
  }];
});

export default {
  getMainCarousel,
  getFlashDeals,
  getNewArrivalList,
  getProducts,
  getShops,
  getBlogs,
  getCategories,
  getServiceList,
  getBestSellers,
  getJustForYou
};