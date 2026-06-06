import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { FALLBACK_PRODUCT_IMAGE, normalizeProductImageUrl } from "./catalog";

export const ALL_PRODUCT_STATUS = "ALL";
export const ACTIVE_STATUS = "ACTIVE";
export const INACTIVE_STATUS = "INACTIVE";

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getProductPrimaryImage(product) {
  const firstImage = ensureArray(product?.images).find(item => item?.imageUrl);
  return normalizeProductImageUrl(firstImage?.imageUrl || FALLBACK_PRODUCT_IMAGE);
}

function normalizeProductImages(images) {
  return ensureArray(images).map(image => ({
    ...image,
    imageUrl: normalizeProductImageUrl(image?.imageUrl)
  }));
}

function normalizeAdminProduct(product) {
  if (!product || typeof product !== "object") {
    return product;
  }

  return {
    ...product,
    images: normalizeProductImages(product.images)
  };
}

export function mapAdminProduct(product) {
  const price = Number(product?.price ?? 0);
  const status = product?.status || ACTIVE_STATUS;
  const editKey = product?.slug || product?.id || "";

  return {
    ...product,
    name: product?.name || "Untitled Product",
    categoryName: product?.category?.name || "Unassigned",
    image: getProductPrimaryImage(product),
    price: Number.isFinite(price) ? price : 0,
    status,
    isActive: status === ACTIVE_STATUS,
    editHref: editKey ? `/admin/products/${editKey}` : null
  };
}

export function parseImageUrls(value = "") {
  return [...new Set(String(value).split(/[\n,]/).map(item => item.trim()).filter(Boolean))];
}

export function serializeImageUrls(images) {
  return ensureArray(images).map(item => typeof item === "string" ? item : item?.imageUrl).filter(Boolean).join("\n");
}

function buildAdminProductsQuery(filters = {}) {
  const params = new URLSearchParams();
  const query = filters.q?.trim() || filters.search?.trim();

  if (query) {
    params.set("q", query);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.status && filters.status !== ALL_PRODUCT_STATUS) {
    params.set("status", filters.status);
  }

  if (Number(filters.page) > 0) {
    params.set("page", String(filters.page));
  }

  if (Number(filters.limit) > 0) {
    params.set("limit", String(filters.limit));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchAdminProducts(filters = {}) {
  const data = await apiGet(`/products${buildAdminProductsQuery(filters)}`);

  if (Array.isArray(data)) {
    return {
      items: data.map(normalizeAdminProduct),
      pagination: {
        page: 1,
        limit: data.length || Number(filters.limit) || 10,
        total: data.length,
        totalPages: 1
      }
    };
  }

  return {
    items: ensureArray(data?.items).map(normalizeAdminProduct),
    pagination: {
      page: Number(data?.pagination?.page || filters.page || 1),
      limit: Number(data?.pagination?.limit || filters.limit || 10),
      total: Number(data?.pagination?.total || 0),
      totalPages: Number(data?.pagination?.totalPages || 1)
    }
  };
}

export async function fetchAdminProductBySlug(slug) {
  const data = await apiGet(`/products/${encodeURIComponent(slug)}`);
  return normalizeAdminProduct(data);
}

export async function fetchAdminCategories() {
  const data = await apiGet("/categories");
  return ensureArray(data);
}

export async function createAdminProduct(payload) {
  return apiPost("/products", payload);
}

export async function updateAdminProduct(id, payload) {
  return apiPatch(`/products/${id}`, payload);
}

export async function uploadAdminProductImages(id, files) {
  const formData = new FormData();

  files.forEach(file => {
    formData.append("files", file);
  });

  return apiPost(`/products/${id}/images`, formData);
}

export async function deleteAdminProductImage(id, imageId) {
  return apiDelete(`/products/${id}/images/${imageId}`);
}

export async function updateAdminProductStatus(id, isActive) {
  return updateAdminProduct(id, {
    status: isActive ? ACTIVE_STATUS : INACTIVE_STATUS
  });
}

export async function deleteAdminProduct(id) {
  return apiDelete(`/products/${id}`);
}

// ── Phase E: Variants ─────────────────────────────────────────────────────────

export async function adminFetchVariants(productId) {
  return apiGet(`/products/${productId}/variants`);
}

export async function adminCreateVariant(productId, data) {
  return apiPost(`/products/${productId}/variants`, data);
}

export async function adminUpdateVariant(productId, variantId, data) {
  return apiPatch(`/products/${productId}/variants/${variantId}`, data);
}

export async function adminDeleteVariant(productId, variantId) {
  return apiDelete(`/products/${productId}/variants/${variantId}`);
}

// ── Phase E: Bundles ──────────────────────────────────────────────────────────

export async function adminFetchBundles() {
  return apiGet("/admin/bundles");
}

export async function adminCreateBundle(data) {
  return apiPost("/admin/bundles", data);
}

export async function adminUpdateBundle(id, data) {
  return apiPatch(`/admin/bundles/${id}`, data);
}

export async function adminDeleteBundle(id) {
  return apiDelete(`/admin/bundles/${id}`);
}

export async function adminAddBundleItem(bundleId, data) {
  return apiPost(`/admin/bundles/${bundleId}/items`, data);
}

export async function adminRemoveBundleItem(bundleId, productId) {
  return apiDelete(`/admin/bundles/${bundleId}/items/${productId}`);
}

// ── Phase E: Product Relations ────────────────────────────────────────────────

export async function adminFetchRelations(productId) {
  return apiGet(`/products/${productId}/relations`);
}

export async function adminAddRelation(productId, data) {
  return apiPost(`/products/${productId}/relations`, data);
}

export async function adminRemoveRelation(productId, targetId, relationType) {
  return apiDelete(`/products/${productId}/relations/${targetId}?type=${relationType}`);
}