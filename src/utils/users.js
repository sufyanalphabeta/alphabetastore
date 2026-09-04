import { apiGet, apiPatch } from "./api";

export const PAYMENT_METHOD_OPTIONS = [{
  value: "COD",
  label: "Cash on Delivery"
}, {
  value: "BANK_TRANSFER",
  label: "Bank Transfer"
}];

function normalizePreferredPaymentMethod(value) {
  return PAYMENT_METHOD_OPTIONS.some(option => option.value === value) ? value : "COD";
}

export function formatPreferredPaymentMethod(value) {
  return PAYMENT_METHOD_OPTIONS.find(option => option.value === normalizePreferredPaymentMethod(value))?.label || "Cash on Delivery";
}

export function mapUserProfile(user) {
  return {
    id: user?.id || "",
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    customerCode: user?.customerCode || "",
    preferredPaymentMethod: normalizePreferredPaymentMethod(user?.preferredPaymentMethod),
    role: user?.role || "CUSTOMER",
    status: user?.status || "ACTIVE",
    createdAt: user?.createdAt || null
  };
}

export async function fetchMyProfile() {
  const data = await apiGet("/users/me");
  return mapUserProfile(data);
}

export async function updateMyProfile(payload) {
  const data = await apiPatch("/users/me", payload);
  return mapUserProfile(data);
}
