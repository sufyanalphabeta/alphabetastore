import { API_BASE_URL, apiDelete, apiGet, apiPatch, apiPost } from "./api";

function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  try {
    return `${new URL(API_BASE_URL).origin}${path}`;
  } catch {
    return path;
  }
}

function withPublicUrls(media) {
  if (!media) return media;
  return {
    ...media,
    thumbnailUrl: mediaUrl(media.thumbnailUrl),
    cardUrl: mediaUrl(media.cardUrl),
    productUrl: mediaUrl(media.productUrl),
    zoomUrl: mediaUrl(media.zoomUrl)
  };
}

export async function listAdminMedia(params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    limit: String(params.limit || 8)
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.used !== undefined) query.set("used", String(params.used));
  if (params.processingStatus) query.set("processingStatus", params.processingStatus);

  const data = await apiGet(`/admin/media?${query}`);
  return {
    ...data,
    items: Array.isArray(data?.items) ? data.items.map(withPublicUrls) : []
  };
}

export async function getAdminMedia(id) {
  return withPublicUrls(await apiGet(`/admin/media/${encodeURIComponent(id)}`));
}

export async function uploadAdminMedia(file) {
  const body = new FormData();
  body.append("file", file);
  return withPublicUrls(await apiPost("/admin/media", body));
}

export async function updateAdminMedia(id, metadata) {
  return withPublicUrls(await apiPatch(`/admin/media/${encodeURIComponent(id)}`, metadata));
}

export function deleteAdminMedia(id) {
  return apiDelete(`/admin/media/${encodeURIComponent(id)}`);
}

