import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export const HOMEPAGE_BLOCK_TYPES = [
  { value: "HERO_BANNER", label: "Hero Banner" },
  { value: "FEATURED_CATEGORIES", label: "Featured Categories" },
  { value: "FEATURED_BRANDS", label: "Featured Brands" },
  { value: "NEW_ARRIVALS", label: "New Arrivals" },
  { value: "BEST_SELLERS", label: "Best Sellers" },
  { value: "PROMOTIONS", label: "Promotions" },
  { value: "RECENTLY_ADDED", label: "Recently Added" },
  { value: "CUSTOM_PRODUCTS", label: "Custom Products" }
];

export async function fetchHomepageLayout() {
  const data = await apiGet("/homepage/layout");
  return ensureArray(data);
}

export async function fetchHomepageBlocks() {
  const data = await apiGet("/homepage/blocks");
  return ensureArray(data);
}

export async function createHomepageBlock(payload) {
  return apiPost("/homepage/blocks", payload);
}

export async function updateHomepageBlock(id, payload) {
  return apiPatch(`/homepage/blocks/${id}`, payload);
}

export async function deleteHomepageBlock(id) {
  return apiDelete(`/homepage/blocks/${id}`);
}

export async function reorderHomepageBlocks(items) {
  return apiPatch(`/homepage/blocks/reorder`, { items });
}
