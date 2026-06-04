import { API_BASE_URL } from "./api";

export const FALLBACK_PRODUCT_IMAGE = "/assets/images/products/apple-watch.png";

const MISSING_PRODUCT_IMAGE_PATHS = new Set([
  "/assets/images/products/placeholder.png",
  "placeholder.png"
]);

function getBackendOrigin() {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
}

export function normalizeProductImageUrl(imageUrl) {
  const nextImageUrl = String(imageUrl || "").trim();

  if (!nextImageUrl || MISSING_PRODUCT_IMAGE_PATHS.has(nextImageUrl)) {
    return FALLBACK_PRODUCT_IMAGE;
  }

  if (/^https?:\/\//i.test(nextImageUrl)) {
    return nextImageUrl;
  }

  if (nextImageUrl.startsWith("/uploads/")) {
    const backendOrigin = getBackendOrigin();
    return backendOrigin ? `${backendOrigin}${nextImageUrl}` : nextImageUrl;
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

  if (filters.minPrice !== undefined && filters.minPrice !== "" && Number(filters.minPrice) >= 0) {
    params.set("minPrice", String(Number(filters.minPrice)));
  }

  if (filters.maxPrice !== undefined && filters.maxPrice !== "" && Number(filters.maxPrice) > 0) {
    params.set("maxPrice", String(Number(filters.maxPrice)));
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
    cacheMode: "force-cache",
    revalidate: 120
  });
}

export async function fetchCategoriesTree(onlyVisible = true) {
  const url = onlyVisible ? "/categories/tree?visible=true" : "/categories/tree";
  return fetchCatalog(url, "Failed to load category tree", [], {
    cacheMode: "force-cache",
    revalidate: 120
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
    cacheMode: "force-cache",
    revalidate: 120
  });
}

export async function fetchBrandBySlugPublic(slug) {
  return fetchCatalog(`/brands/slug/${encodeURIComponent(slug)}`, "Failed to load brand", null, {
    cacheMode: "no-store"
  });
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
  const product = await fetchCatalog(`/products/${encodeURIComponent(slug)}`, "Failed to load products", null);
  return mapCatalogProduct(product);
}

export function mapCatalogProduct(product) {
  const imageUrls = Array.isArray(product?.images) ? product.images.map(item => normalizeProductImageUrl(item?.imageUrl)).filter(Boolean) : [];
  const images = imageUrls.length ? imageUrls : [FALLBACK_PRODUCT_IMAGE];
  const price = Number(product?.price ?? 0);
  const categoryName = product?.category?.name || "";
  const categories = Array.isArray(product?.categories) ? product.categories.map(item => item?.name || item).filter(Boolean) : categoryName ? [categoryName] : [];
  const slug = product?.slug || product?.id || "";

  return {
    ...product,
    slug,
    title: product?.name || "Untitled Product",
    thumbnail: images[0],
    images,
    categories,
    price: Number.isFinite(price) ? price : 0,
    discount: 0,
    rating: 0,
    reviews: [],
    brand: product?.brand || null,
    sku: product?.sku || null,
    specs: product?.specs || null,
    shop: null,
    categoryName
  };
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
  const visibleNodes = (Array.isArray(tree) ? tree : []).filter(n => n?.isActive !== false && n?.isVisible !== false);
  return [...visibleNodes]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map(parent => {
      const childGroups = (parent.children || [])
        .filter(c => c?.isActive !== false && c?.isVisible !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
        .map(child => {
          const grandchildren = (child.children || [])
            .filter(g => g?.isActive !== false && g?.isVisible !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
            .map(g => ({ title: g.name, href: createCategoryHref(g.slug) }));
          return {
            title: child.name,
            href: createCategoryHref(child.slug),
            children: grandchildren
          };
        });
      return {
        title: parent.name,
        href: createCategoryHref(parent.slug),
        icon: parent.icon || undefined,
        component: childGroups.length ? "Grid" : undefined,
        children: childGroups.length ? childGroups : undefined
      };
    });
}

export function buildMobileCategoryMenusFromTree(tree) {
  const visibleNodes = (Array.isArray(tree) ? tree : []).filter(n => n?.isActive !== false && n?.isVisible !== false);
  return [...visibleNodes]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map(parent => ({
      icon: parent.icon || "CategoryOutline",
      title: parent.name,
      href: createCategoryHref(parent.slug),
      children: (parent.children || [])
        .filter(c => c?.isActive !== false && c?.isVisible !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(child => ({
          title: child.name,
          href: createCategoryHref(child.slug),
          children: (child.children || [])
            .filter(g => g?.isActive !== false && g?.isVisible !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map(g => ({ title: g.name, href: createCategoryHref(g.slug) }))
        }))
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