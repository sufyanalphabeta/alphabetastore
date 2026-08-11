import { apiGet, apiPost } from "./api";

export const IMPORT_STATUS = {
  UPLOADED: "UPLOADED",
  ANALYZING: "ANALYZING",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  APPROVED: "APPROVED",
  APPLYING: "APPLYING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
};

export const ROW_STATUS_LABELS = {
  NEW: "منتج جديد",
  UNCHANGED: "بدون تغيير",
  PRICE_CHANGED: "تغير السعر",
  CATEGORY_CHANGED: "تغير التصنيف",
  CONFLICT: "تعارض",
  INVALID: "يحتاج مراجعة",
  APPLIED: "تم التطبيق"
};

export const SESSION_STATUS_LABELS = {
  UPLOADED: "تم الرفع",
  ANALYZING: "جارٍ التحليل",
  READY_FOR_REVIEW: "جاهز للمراجعة",
  APPROVED: "تم الاعتماد",
  APPLYING: "جارٍ التنفيذ",
  COMPLETED: "مكتمل",
  FAILED: "فشل"
};

export const ISSUE_LABELS = {
  ZERO_PRICE: "السعر صفر أو غير صالح",
  NAME_REQUIRED: "اسم المنتج مفقود",
  REQUIRED_VALUE_MISSING: "بيانات مطلوبة ناقصة",
  CATEGORY_REQUIRED: "التصنيف غير محدد",
  CATEGORY_MAPPING_REQUIRED: "يجب ربط التصنيف أولًا",
  MANUAL_BARCODE_MATCH_UNAVAILABLE: "تعذر مطابقة الباركود",
  MERCHANT_NAME_ENRICHMENT_DETECTED: "تم الحفاظ على تعديل يدوي"
};

export function translateStatus(status) {
  return ROW_STATUS_LABELS[status] || SESSION_STATUS_LABELS[status] || status || "غير معروف";
}

export function formatIssue(issue) {
  if (typeof issue === "string") return ISSUE_LABELS[issue] || issue;
  return ISSUE_LABELS[issue?.code] || issue?.message || issue?.code || "مراجعة البيانات";
}

export function summarizeSession(session) {
  return {
    total: Number(session?.totalRows || 0),
    newCount: Number(session?.newCount || 0),
    unchanged: Number(session?.unchangedCount || 0),
    priceChanged: Number(session?.issueCounts?.PRICE_CHANGED || 0),
    changed: Number(session?.changedCount || 0),
    conflicts: Number(session?.conflictCount || 0),
    invalid: Number(session?.invalidCount || 0),
    needsReview: Number(session?.invalidCount || 0) + Number(session?.conflictCount || 0)
  };
}

export async function listCatalogImports() {
  return apiGet("/admin/catalog-imports");
}

export async function getCatalogImport(id) {
  return apiGet(`/admin/catalog-imports/${encodeURIComponent(id)}`);
}

export async function getCatalogImportRows(id, params = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 25)
  });
  if (params.status && params.status !== "ALL") query.set("status", params.status);
  return apiGet(`/admin/catalog-imports/${encodeURIComponent(id)}/rows?${query}`);
}

export async function getUnmappedCategories(id) {
  return apiGet(`/admin/catalog-imports/${encodeURIComponent(id)}/unmapped-categories`);
}

export async function resolveImportCategory(id, payload) {
  return apiPost(`/admin/catalog-imports/${encodeURIComponent(id)}/category-mappings`, payload);
}

export async function applyCatalogImport(id) {
  return apiPost(`/admin/catalog-imports/${encodeURIComponent(id)}/apply`, {});
}

export async function uploadCatalogImport(file) {
  const body = new FormData();
  body.append("file", file);
  return apiPost("/admin/catalog-imports", body);
}

export async function getAdminCategoryTree() {
  return apiGet("/categories/tree");
}

