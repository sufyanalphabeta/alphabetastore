import { API_BASE_URL } from "./api";

export const FALLBACK_PRODUCT_IMAGE = "/assets/images/products/alphabeta-product-placeholder.svg";

const BRAND_LOGOS = {
  acer: "/assets/images/brands/acer.png",
  apple: "/assets/images/brands/apple.png",
  asus: "/assets/images/brands/asus.png",
  dell: "/assets/images/brands/dell.png",
  hp: "/assets/images/brands/hp.png",
  samsung: "/assets/images/brands/samsung.png",
  sony: "/assets/images/brands/sony.png",
  xiaomi: "/assets/images/brands/xiaomi.png"
};

export function getBrandLogoUrl(brand) {
  const configured = String(brand?.logoUrl || "").trim();
  if (configured) return normalizeProductImageUrl(configured);
  return BRAND_LOGOS[String(brand?.slug || "").trim().toLowerCase()] || "";
}

const MISSING_PRODUCT_IMAGE_PATHS = new Set([
  "/assets/images/products/placeholder.png",
  "placeholder.png"
]);

export function normalizeProductImageUrl(imageUrl) {
  const nextImageUrl = String(imageUrl || "").trim();

  if (!nextImageUrl || MISSING_PRODUCT_IMAGE_PATHS.has(nextImageUrl)) {
    return FALLBACK_PRODUCT_IMAGE;
  }

  if (/^https?:\/\//i.test(nextImageUrl)) {
    return nextImageUrl;
  }

  if (nextImageUrl.startsWith("/uploads/")) {
    // Public media is always browser-facing. The frontend /uploads rewrite
    // proxies it to local storage without leaking Docker-only hostnames.
    return nextImageUrl;
  }

  return nextImageUrl;
}

function buildCatalogQueryString(filters = {}) {
  const params = new URLSearchParams();
  const query = filters.q?.trim() || filters.search?.trim();

  if (query) {
    params.set("q", query);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.brand) {
    params.set("brand", filters.brand);
  }

  if (filters.brandSlug) {
    params.set("brandSlug", filters.brandSlug);
  }

  if (filters.brandId) {
    params.set("brandId", filters.brandId);
  }

  if (filters.inStock) {
    params.set("inStock", "true");
  }

  if (filters.availability) {
    params.set("availability", filters.availability);
  }

  if (filters.featured === true) {
    params.set("featured", "true");
  }

  if (filters.minPrice !== undefined && filters.minPrice !== "" && Number(filters.minPrice) >= 0) {
    params.set("minPrice", String(Number(filters.minPrice)));
  }

  if (filters.maxPrice !== undefined && filters.maxPrice !== "" && Number(filters.maxPrice) > 0) {
    params.set("maxPrice", String(Number(filters.maxPrice)));
  }

  if (filters.attributeFilters && Object.keys(filters.attributeFilters).length) {
    params.set("attributeFilters", JSON.stringify(filters.attributeFilters));
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.sort && filters.sort !== "relevance") {
    params.set("sort", filters.sort);
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

function unwrapEnvelope(payload) {
  if (payload && typeof payload === "object" && payload.success === true && "data" in payload) {
    return payload.data;
  }

  return payload;
}

function readEnvelopeErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object" && payload.success === false && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string") {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(", ");
    }
  }

  return fallbackMessage;
}

async function fetchCatalog(path, fallbackMessage, fallbackData, options = {}) {
  const requestOptions = {
    cache: options.cacheMode || "force-cache"
  };

  if (typeof window === "undefined" && Number(options.revalidate || 0) > 0) {
    requestOptions.next = {
      revalidate: Number(options.revalidate)
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(readEnvelopeErrorMessage(data, fallbackMessage));
    }

    return unwrapEnvelope(data);
  } catch (error) {
    if (error instanceof Error && /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message)) {
      throw new Error("Server unavailable");
    }

    throw error instanceof Error ? error : new Error(fallbackMessage);
  }
}

function normalizeCategories(categories) {
  return (Array.isArray(categories) ? categories : []).filter(item => item?.isActive !== false);
}

function sortByName(items) {
  return [...items].sort((left, right) => {
    const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return left.name.localeCompare(right.name);
  });
}

function createCategoryHref(slug) {
  return `/products/search?category=${encodeURIComponent(slug)}`;
}

export async function fetchCategories(onlyVisible = false) {
  const url = onlyVisible ? "/categories?visible=true" : "/categories";
  return fetchCatalog(url, "Failed to load categories", [], {
    // Category visibility, hierarchy, and ordering are managed from the
    // admin panel. Do not keep an old browser response after an admin change.
    cacheMode: "no-store"
  });
}

export function mapProductGallery(product) {
  const mediaGallery = Array.isArray(product?.gallery) ? product.gallery
    .filter(item => item && item.role !== "VIDEO")
    .sort((left, right) => {
      const roleDifference = Number(right.role === "PRIMARY") - Number(left.role === "PRIMARY");
      return roleDifference || Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
    })
    .map(item => {
      const availableUrl = item.productUrl || item.cardUrl || item.thumbnailUrl || item.zoomUrl;
      const productUrl = normalizeProductImageUrl(item.productUrl || availableUrl);
      return {
        id: item.id,
        mediaAssetId: item.mediaAssetId || null,
        role: item.role || "GALLERY",
        sortOrder: Number(item.sortOrder || 0),
        thumbnailUrl: normalizeProductImageUrl(item.thumbnailUrl || availableUrl),
        cardUrl: normalizeProductImageUrl(item.cardUrl || productUrl),
        productUrl,
        zoomUrl: normalizeProductImageUrl(item.zoomUrl || productUrl),
        altText: item.altText || null
      };
    }) : [];

  if (mediaGallery.length) return mediaGallery;

  if (product?.cardImageUrl) {
    const cardUrl = normalizeProductImageUrl(product.cardImageUrl);
    return [{
      id: `card-${product.id || product.slug || "product"}`,
      mediaAssetId: null,
      role: "PRIMARY",
      sortOrder: 0,
      thumbnailUrl: cardUrl,
      cardUrl,
      productUrl: cardUrl,
      zoomUrl: cardUrl,
      altText: product.name || null
    }];
  }
  const legacy = Array.isArray(product?.images) ? product.images : [];
  return legacy.map((item, index) => {
    const url = normalizeProductImageUrl(item?.imageUrl);
    return { id: item?.id || `legacy-${index}`, mediaAssetId: null, role: index === 0 ? "PRIMARY" : "GALLERY", sortOrder: index, thumbnailUrl: url, cardUrl: url, productUrl: url, zoomUrl: url, altText: null };
  });
}

export function getProductCardImage(product) {
  return mapProductGallery(product)[0]?.cardUrl || FALLBACK_PRODUCT_IMAGE;
}

export async function fetchCategoriesTree(onlyVisible = true) {
  const url = onlyVisible ? "/categories/tree?visible=true" : "/categories/tree";
  return fetchCatalog(url, "Failed to load category tree", [], {
    // The mega menu is a live reflection of the admin category tree.
    cacheMode: "no-store"
  });
}

export async function fetchFeaturedCategories(limit = 8) {
  return fetchCatalog(`/categories/featured?limit=${limit}`, "Failed to load featured categories", [], {
    cacheMode: "force-cache",
    revalidate: 120
  });
}

export async function fetchBrandsPublic({ onlyVisible = true, onlyFeatured = false } = {}) {
  const params = new URLSearchParams();
  if (onlyVisible) params.set("visible", "true");
  if (onlyFeatured) params.set("featured", "true");
  const qs = params.toString();
  return fetchCatalog(`/brands${qs ? `?${qs}` : ""}`, "Failed to load brands", [], {
    // Brand visibility and product counts drive discovery facets. Keep them
    // fresh after catalog/import changes instead of reusing stale browser data.
    cacheMode: "no-store"
  });
}

export async function fetchBrandBySlugPublic(slug) {
  return fetchCatalog(`/brands/slug/${encodeURIComponent(slug)}`, "Failed to load brand", null, {
    cacheMode: "no-store"
  });
}

export async function fetchCategoryBySlug(slug) {
  return fetchCatalog(`/categories/slug/${encodeURIComponent(slug)}`, "Failed to load category", null, {
    cacheMode: "no-store"
  });
}

export async function fetchCategoryAttributeFilters(slug) {
  return fetchCatalog(`/attributes/category/${encodeURIComponent(slug)}/filters`, "Failed to load attribute filters", { profile: null, filters: [] }, { cacheMode: "no-store" });
}

export async function fetchHomepageLayout() {
  return fetchCatalog("/homepage/layout", "Failed to load homepage", [], {
    cacheMode: "no-store"
  });
}

export async function fetchProducts(filters = {}) {
  const response = await fetchCatalog(`/products${buildCatalogQueryString(filters)}`, "Failed to load products", [], {
    cacheMode: filters.noStore ? "no-store" : "force-cache",
    revalidate: filters.noStore ? 0 : 30
  });

  const products = Array.isArray(response?.items) ? response.items : response;
  return Array.isArray(products) ? products.map(mapCatalogProduct) : [];
}

export async function fetchProductsPage(filters = {}) {
  const response = await fetchCatalog(`/products${buildCatalogQueryString(filters)}`, "Failed to load products", {
    items: [],
    pagination: {
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 1
    }
  }, {
    cacheMode: "no-store"
  });

  const items = Array.isArray(response?.items) ? response.items : [];

  return {
    products: items.map(mapCatalogProduct),
    pagination: {
      page: Number(response?.pagination?.page || filters.page || 1),
      limit: Number(response?.pagination?.limit || filters.limit || 12),
      total: Number(response?.pagination?.total || items.length),
      totalPages: Number(response?.pagination?.totalPages || 1)
    }
  };
}

export async function fetchProductBySlug(slug) {
  const product = await fetchCatalog(`/products/${encodeURIComponent(slug)}`, "Failed to load products", null, { cacheMode: "no-store" });
  return mapCatalogProduct(product);
}

/**
 * Returns a Map of categoryId → product count using a single backend query
 * (no N+1).  Falls back to an empty Map on error.
 */
export async function fetchProductCountsByCategory() {
  try {
    const rows = await fetchCatalog("/products/counts-by-category", "Failed to load category counts", [], { cacheMode: "no-store" });
    if (!Array.isArray(rows)) return new Map();
    return new Map(rows.map(r => [r.categoryId, r.count]));
  } catch {
    return new Map();
  }
}

export function mapCatalogProduct(product) {
  const gallery = mapProductGallery(product);
  const images = gallery.length ? gallery.map(item => item.productUrl) : [FALLBACK_PRODUCT_IMAGE];
  const price = Number(product?.storefrontPrice?.finalPrice ?? product?.price ?? 0);
  const categoryName = product?.category?.name || "";
  const categories = Array.isArray(product?.categories) ? product.categories.map(item => item?.name || item).filter(Boolean) : categoryName ? [categoryName] : [];
  const slug = product?.slug || product?.id || "";

  return {
    ...product,
    slug,
    title: product?.name || "Untitled Product",
    gallery,
    thumbnail: gallery[0]?.cardUrl || FALLBACK_PRODUCT_IMAGE,
    images,
    categories,
    price: Number.isFinite(price) ? price : 0,
    comparePrice: product?.storefrontPrice?.comparePrice ?? product?.comparePrice ?? null,
    discount: Number(product?.storefrontPrice?.discountPercent || 0),
    rating: Number(product?.ratingAvg ?? 0),
    ratingCount: Number(product?.ratingCount ?? 0),
    reviews: [],
    brand: product?.brand || null,
    brandRef: product?.brandRef || null,
    sku: product?.sku || null,
    specs: product?.specs || null,
    highlights: Array.isArray(product?.highlights) ? product.highlights : null,
    shop: null,
    categoryName,
    categorySlug: product?.category?.slug || null,
    hasVariants: Boolean(product?.hasVariants),
    variants: Array.isArray(product?.variants) ? product.variants : [],
    relations: product?.sourceRelations
      ? buildRelationsMap(product.sourceRelations)
      : {},
  };
}

function buildRelationsMap(sourceRelations) {
  const map = {};
  for (const rel of sourceRelations) {
    if (!map[rel.relationType]) map[rel.relationType] = [];
    map[rel.relationType].push(rel.target);
  }
  return map;
}

export async function fetchRelatedProducts(slugOrId, limit = 8) {
  try {
    const rows = await fetchCatalog(
      `/products/${encodeURIComponent(slugOrId)}/related?limit=${limit}`,
      "Failed to load related products",
      [],
      { cacheMode: "no-store" }
    );
    const items = Array.isArray(rows) ? rows : (Array.isArray(rows?.items) ? rows.items : []);
    return items.map(mapCatalogProduct);
  } catch {
    return [];
  }
}

export async function fetchRecentlyViewed(sessionId, limit = 8) {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sessionId) params.set("sessionId", sessionId);
    const rows = await fetchCatalog(
      `/products/recently-viewed?${params}`,
      "Failed to load recently viewed",
      [],
      { cacheMode: "no-store" }
    );
    const items = Array.isArray(rows) ? rows : (Array.isArray(rows?.items) ? rows.items : []);
    return items.map(mapCatalogProduct);
  } catch {
    return [];
  }
}

export async function recordProductView(productId, sessionId) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (sessionId) headers["x-session-id"] = sessionId;
    await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/view`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sessionId: sessionId || undefined }),
      cache: "no-store"
    });
  } catch {
    // fire-and-forget; never throw
  }
}

export async function fetchAutocomplete(q, limit = 5) {
  if (!q || q.trim().length < 2) return { products: [], brands: [], categories: [] };
  try {
    const params = new URLSearchParams({ q: q.trim(), limit: String(limit) });
    const res = await fetch(`${API_BASE_URL}/products/autocomplete?${params}`, { cache: "no-store" });
    if (!res.ok) return { products: [], brands: [], categories: [] };
    const payload = await res.json();
    const data = unwrapEnvelope(payload);
    return {
      products: Array.isArray(data?.products) ? data.products : [],
      brands: Array.isArray(data?.brands) ? data.brands : [],
      categories: Array.isArray(data?.categories) ? data.categories : [],
    };
  } catch {
    return { products: [], brands: [], categories: [] };
  }
}

export async function fetchPopularSearches(limit = 8) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/popular-searches?limit=${Math.min(Number(limit) || 8, 10)}`, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    const data = unwrapEnvelope(payload);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function trackSearchTerm(term) {
  if (!term || term.trim().length < 2) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/products/track-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: term.trim().slice(0, 160) }),
      cache: "no-store"
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const data = unwrapEnvelope(payload);
    return data?.ok && typeof data.term === "string" ? data.term : null;
  } catch {
    return null;
  }
}

// ── Reviews ─────────────────────────────────────────────────────────────────

export async function fetchProductReviews(productId, { page = 1, limit = 10, sort = "newest" } = {}) {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/reviews?${params}`, { cache: "no-store" });
    if (!res.ok) return { items: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
    const payload = await res.json();
    return unwrapEnvelope(payload);
  } catch {
    return { items: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
  }
}

export async function fetchRatingSummary(productId) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/reviews/summary`, { cache: "no-store" });
    if (!res.ok) return { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    const payload = await res.json();
    return unwrapEnvelope(payload);
  } catch {
    return { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }
}

export async function fetchMyReview(productId, token) {
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/reviews/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return unwrapEnvelope(payload);
  } catch {
    return null;
  }
}

export async function submitReview(productId, data, token) {
  const formData = new FormData();
  formData.append("rating", String(data.rating));
  if (data.title) formData.append("title", data.title);
  if (data.comment) formData.append("comment", data.comment);
  if (data.images?.length) {
    for (const file of data.images) formData.append("images", file);
  }
  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/reviews`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store"
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to submit review");
  }
  const payload = await res.json();
  return unwrapEnvelope(payload);
}

export async function updateReview(reviewId, productId, data, token) {
  const formData = new FormData();
  if (data.rating !== undefined) formData.append("rating", String(data.rating));
  if (data.title !== undefined) formData.append("title", data.title);
  if (data.comment !== undefined) formData.append("comment", data.comment);
  if (data.images?.length) {
    for (const file of data.images) formData.append("images", file);
  }
  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/reviews/${reviewId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store"
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to update review");
  }
  const payload = await res.json();
  return unwrapEnvelope(payload);
}

export async function deleteReview(reviewId, productId, token) {
  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/reviews/${reviewId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to delete review");
  }
  const payload = await res.json();
  return unwrapEnvelope(payload);
}

// ── Q&A ──────────────────────────────────────────────────────────────────────

export async function fetchProductQnA(productId, { page = 1, limit = 10 } = {}) {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/qna?${params}`, { cache: "no-store" });
    if (!res.ok) return { items: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
    const payload = await res.json();
    return unwrapEnvelope(payload);
  } catch {
    return { items: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
  }
}

export async function submitQuestion(productId, question, token) {
  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/qna`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
    cache: "no-store"
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to submit question");
  }
  const payload = await res.json();
  return unwrapEnvelope(payload);
}

export async function deleteQuestion(productId, questionId, token) {
  const res = await fetch(
    `${API_BASE_URL}/products/${encodeURIComponent(productId)}/qna/${encodeURIComponent(questionId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to delete question");
  }
  const payload = await res.json();
  return unwrapEnvelope(payload);
}

// ── Phase E: Variants ────────────────────────────────────────────────────────

export async function fetchProductVariants(productId) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/variants`, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    const data = unwrapEnvelope(payload);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Phase E: Bundles ─────────────────────────────────────────────────────────

export async function fetchActiveBundles() {
  try {
    const res = await fetch(`${API_BASE_URL}/bundles`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const payload = await res.json();
    const data = unwrapEnvelope(payload);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchBundle(slugOrId) {
  try {
    // Try slug-based lookup first (for bundle detail pages)
    const res = await fetch(`${API_BASE_URL}/bundles/by-slug/${encodeURIComponent(slugOrId)}`, { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      return unwrapEnvelope(payload);
    }
    // Fallback to ID-based lookup
    const res2 = await fetch(`${API_BASE_URL}/bundles/${encodeURIComponent(slugOrId)}`, { cache: "no-store" });
    if (!res2.ok) return null;
    const payload = await res2.json();
    return unwrapEnvelope(payload);
  } catch {
    return null;
  }
}

// ── Phase E: Product Relations ───────────────────────────────────────────────

export async function fetchProductRelations(productId) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/relations`, { cache: "no-store" });
    if (!res.ok) return {};
    const payload = await res.json();
    const data = unwrapEnvelope(payload);
    // Normalize: map product images inside each relation
    const normalized = {};
    for (const [type, items] of Object.entries(data)) {
      normalized[type] = Array.isArray(items) ? items.map(mapCatalogProduct) : [];
    }
    return normalized;
  } catch {
    return {};
  }
}

export function buildCategoryMenus(categories) {
  // Accept either flat list or tree (nodes with `children`).
  const looksLikeTree = Array.isArray(categories) && categories.some(c => Array.isArray(c?.children));
  if (looksLikeTree) {
    return buildCategoryMenusFromTree(categories);
  }
  const normalized = normalizeCategories(categories);
  const topLevel = sortByName(normalized.filter(item => !item.parentId));

  return topLevel.map(parent => {
    const children = sortByName(normalized.filter(item => item.parentId === parent.id)).map(child => ({
      title: child.name,
      href: createCategoryHref(child.slug)
    }));

    return {
      title: parent.name,
      href: children[0]?.href || createCategoryHref(parent.slug),
      icon: parent.icon || undefined,
      component: children.length ? "Grid" : undefined,
      children: children.length ? [{
        title: parent.name,
        href: createCategoryHref(parent.slug),
        children
      }] : undefined
    };
  });
}

export function buildCategoryMenusFromTree(tree) {
  const mapNode = node => {
    const children = (node.children || [])
      .filter(child => child?.isActive !== false && child?.isVisible !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
      .map(mapNode);
    return {
      id: node.id,
      title: node.name,
      href: createCategoryHref(node.slug),
      icon: node.icon || undefined,
      isFeatured: Boolean(node.isFeatured),
      productCount: Number(node.productCount || 0),
      directProductCount: Number(node.directProductCount || 0),
      ...(children.length ? { component: "Grid", children } : {})
    };
  };

  return (Array.isArray(tree) ? tree : [])
    .filter(node => node?.isActive !== false && node?.isVisible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map(mapNode);
}

export function buildMobileCategoryMenusFromTree(tree) {
  return buildCategoryMenusFromTree(tree).map(node => ({
    ...node,
    icon: node.icon || "CategoryOutline"
  }));
}

export function buildMobileCategoryMenus(categories) {
  const looksLikeTree = Array.isArray(categories) && categories.some(c => Array.isArray(c?.children));
  if (looksLikeTree) {
    return buildMobileCategoryMenusFromTree(categories);
  }
  const normalized = normalizeCategories(categories);
  const topLevel = sortByName(normalized.filter(item => !item.parentId));

  return topLevel.map(parent => ({
    icon: "CategoryOutline",
    title: parent.name,
    href: createCategoryHref(parent.slug),
    children: sortByName(normalized.filter(item => item.parentId === parent.id)).map(child => ({
      title: child.name,
      href: createCategoryHref(child.slug)
    }))
  }));
}

export function buildProductFilters(categories) {
  const normalized = normalizeCategories(categories);
  const topLevel = sortByName(normalized.filter(item => !item.parentId));

  return {
    brands: [],
    others: [],
    colors: [],
    categories: topLevel.map(parent => {
      const children = sortByName(normalized.filter(item => item.parentId === parent.id)).map(child => ({
        title: child.name,
        slug: child.slug
      }));

      return children.length ? {
        title: parent.name,
        slug: parent.slug,
        children
      } : {
        title: parent.name,
        slug: parent.slug
      };
    })
  };
}

export function filterCatalogProducts(products, options = {}) {
  const {
    q,
    category,
    sort
  } = options;

  let filteredProducts = Array.isArray(products) ? [...products] : [];

  if (q) {
    const query = q.trim().toLowerCase();
    filteredProducts = filteredProducts.filter(product => {
      const haystacks = [product.title, product.description, product.shortDescription, product.category?.name];
      return haystacks.filter(Boolean).some(value => value.toLowerCase().includes(query));
    });
  }

  if (category) {
    filteredProducts = filteredProducts.filter(product => product.category?.slug === category);
  }

  if (sort === "asc") {
    filteredProducts.sort((left, right) => left.price - right.price);
  } else if (sort === "desc") {
    filteredProducts.sort((left, right) => right.price - left.price);
  } else if (sort === "date") {
    filteredProducts.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  return filteredProducts;
}
