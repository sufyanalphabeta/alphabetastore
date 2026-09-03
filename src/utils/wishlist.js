import { apiDelete, apiGet, apiPost } from "./api";
import { mapCatalogProduct } from "./catalog";

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function mapWishlistItem(item) {
  const product = item?.product || {};

  return {
    id: item?.id || "",
    createdAt: item?.createdAt || null,
    product: {
      ...mapCatalogProduct(product),
      categories: product?.category?.name ? [product.category.name] : []
    }
  };
}

function buildWishlistQuery(filters = {}) {
  const params = new URLSearchParams();

  if (Number(filters.page) > 0) {
    params.set("page", String(filters.page));
  }

  if (Number(filters.limit) > 0) {
    params.set("limit", String(filters.limit));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchWishlistItems() {
  const data = await apiGet("/wishlist");
  return ensureArray(data).map(mapWishlistItem);
}

export async function fetchWishlistItemsPage(filters = {}) {
  const data = await apiGet(`/wishlist${buildWishlistQuery(filters)}`);

  if (Array.isArray(data)) {
    return {
      items: data.map(mapWishlistItem),
      pagination: {
        page: Number(filters.page || 1),
        limit: Number(filters.limit || data.length || 6),
        total: data.length,
        totalPages: 1
      }
    };
  }

  const items = ensureArray(data?.items);

  return {
    items: items.map(mapWishlistItem),
    pagination: {
      page: Number(data?.pagination?.page || filters.page || 1),
      limit: Number(data?.pagination?.limit || filters.limit || 6),
      total: Number(data?.pagination?.total || items.length),
      totalPages: Number(data?.pagination?.totalPages || 1)
    }
  };
}

export async function addWishlistItem(productId) {
  const data = await apiPost("/wishlist", { productId });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wishlist:changed"));
  return mapWishlistItem(data);
}

export async function removeWishlistItem(productId) {
  const result = await apiDelete(`/wishlist/${productId}`);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wishlist:changed"));
  return result;
}
