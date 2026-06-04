import { apiGet, apiPatch, apiPost } from "./api";
import { FALLBACK_PRODUCT_IMAGE, normalizeProductImageUrl } from "./catalog";
import { formatPaymentStatus } from "./payments";

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export const ORDER_STATUS_OPTIONS = [{
  value: "PENDING",
  label: "Pending"
}, {
  value: "CONFIRMED",
  label: "Confirmed"
}, {
  value: "PROCESSING",
  label: "Processing"
}, {
  value: "DELIVERED",
  label: "Delivered"
}, {
  value: "CANCELLED",
  label: "Cancelled"
}];

export function formatOrderStatus(status) {
  const matchedStatus = ORDER_STATUS_OPTIONS.find(item => item.value === status);
  return matchedStatus?.label || "Pending";
}

export function mapOrderItem(item) {
  return {
    id: item?.id || "",
    productId: item?.productId || "",
    productName: item?.productName || item?.product?.name || "",
    quantity: Number(item?.quantity || 0),
    unitPrice: Number(item?.unitPrice || 0),
    product: {
      id: item?.product?.id || item?.productId || "",
      name: item?.productName || item?.product?.name || "",
      slug: item?.product?.slug || "",
      imageUrl: normalizeProductImageUrl(item?.product?.imageUrl || FALLBACK_PRODUCT_IMAGE)
    }
  };
}

export function mapOrder(order) {
  const items = ensureArray(order?.items).map(mapOrderItem);
  const rawStatus = order?.status || "PENDING";
  const statusHistory = ensureArray(order?.statusHistory).map(entry => ({
    id: entry?.id || "",
    rawStatus: entry?.status || rawStatus,
    statusLabel: formatOrderStatus(entry?.status || rawStatus),
    note: entry?.note || "",
    createdAt: entry?.createdAt || null,
    changedByUser: entry?.changedByUser ? {
      id: entry.changedByUser.id || "",
      name: entry.changedByUser.name || "System",
      role: entry.changedByUser.role || null
    } : null
  }));

  return {
    id: order?.id || "",
    userId: order?.userId || null,
    addressId: order?.addressId || null,
    orderNumber: order?.orderNumber || "",
    fullName: order?.fullName || "",
    phone: order?.phone || "",
    city: order?.city || "",
    address: order?.address || "",
    notes: order?.notes || "",
    status: rawStatus,
    statusLabel: formatOrderStatus(rawStatus),
    rawStatus,
    totalAmount: Number(order?.totalAmount || 0),
    paymentTransactionId: order?.paymentTransactionId || null,
    paymentMethodCode: order?.paymentMethodCode || null,
    paymentStatus: order?.paymentStatus || null,
    paymentStatusLabel: formatPaymentStatus(order?.paymentStatus),
    paymentReceipt: order?.paymentReceipt || null,
    createdAt: order?.createdAt,
    shippingAddress: [order?.address, order?.city].filter(Boolean).join(", "),
    savedAddress: order?.savedAddress || null,
    statusHistory,
    items,
    paymentMethod: order?.paymentMethod || ""
  };
}

function buildOrdersQuery(filters = {}) {
  const params = new URLSearchParams();
  const query = filters.q?.trim();

  if (query) {
    params.set("q", query);
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

function normalizePaginatedOrdersResponse(data, filters = {}) {
  if (Array.isArray(data)) {
    return {
      items: data.map(mapOrder),
      pagination: {
        page: Number(filters.page || 1),
        limit: Number(filters.limit || data.length || 10),
        total: data.length,
        totalPages: 1
      }
    };
  }

  const items = ensureArray(data?.items);

  return {
    items: items.map(mapOrder),
    pagination: {
      page: Number(data?.pagination?.page || filters.page || 1),
      limit: Number(data?.pagination?.limit || filters.limit || 10),
      total: Number(data?.pagination?.total || items.length),
      totalPages: Number(data?.pagination?.totalPages || 1)
    }
  };
}

export async function fetchCustomerOrders() {
  const data = await apiGet("/orders/my");
  return ensureArray(data).map(mapOrder);
}

export async function fetchCustomerOrdersPage(filters = {}) {
  const data = await apiGet(`/orders/my${buildOrdersQuery(filters)}`);
  return normalizePaginatedOrdersResponse(data, filters);
}

export async function fetchCustomerOrderById(id) {
  const data = await apiGet(`/orders/${id}`);
  return mapOrder(data);
}

export async function cancelCustomerOrder(id, note) {
  const data = await apiPost(`/orders/${id}/cancel`, note ? { note } : {});
  return mapOrder(data);
}

export async function fetchAdminOrders() {
  const data = await apiGet("/orders");
  return ensureArray(data).map(mapOrder);
}

export async function fetchAdminOrdersPage(filters = {}) {
  const data = await apiGet(`/orders${buildOrdersQuery(filters)}`);
  return normalizePaginatedOrdersResponse(data, filters);
}

export async function fetchAdminOrderById(id) {
  const data = await apiGet(`/orders/${id}`);
  return mapOrder(data);
}

export async function updateAdminOrderStatus(id, payload) {
  const data = await apiPatch(`/orders/${id}/status`, payload);
  return mapOrder(data);
}