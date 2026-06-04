import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { normalizeProductImageUrl } from "./catalog";

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeBrand(brand) {
  if (!brand || typeof brand !== "object") return brand;
  return {
    ...brand,
    logoUrl: brand.logoUrl ? normalizeProductImageUrl(brand.logoUrl) : "",
    productCount: Number(brand.productCount ?? 0),
    sortOrder: Number(brand.sortOrder ?? 0),
    isVisible: brand.isVisible !== false,
    isFeatured: Boolean(brand.isFeatured)
  };
}

export async function fetchBrands({ onlyVisible = false, onlyFeatured = false } = {}) {
  const params = new URLSearchParams();
  if (onlyVisible) params.set("visible", "true");
  if (onlyFeatured) params.set("featured", "true");
  const qs = params.toString();
  const data = await apiGet(`/brands${qs ? `?${qs}` : ""}`);
  return ensureArray(data).map(normalizeBrand);
}

export async function fetchBrandBySlug(slug) {
  const data = await apiGet(`/brands/slug/${encodeURIComponent(slug)}`);
  return normalizeBrand(data);
}

export async function createBrand(payload) {
  const data = await apiPost("/brands", payload);
  return normalizeBrand(data);
}

export async function updateBrand(id, payload) {
  const data = await apiPatch(`/brands/${id}`, payload);
  return normalizeBrand(data);
}

export async function deleteBrand(id) {
  return apiDelete(`/brands/${id}`);
}

export async function reorderBrands(items) {
  return apiPatch(`/brands/reorder`, { items });
}

export async function uploadBrandLogo(id, file) {
  const formData = new FormData();
  formData.append("file", file);
  const data = await apiPost(`/brands/${id}/logo`, formData);
  return normalizeBrand(data);
}
