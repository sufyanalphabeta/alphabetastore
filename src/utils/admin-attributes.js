import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./api";

export const fetchAttributeDefinitions = () => apiGet("/attributes/admin/definitions");
export const createAttributeDefinition = payload => apiPost("/attributes/admin/definitions", payload);
export const updateAttributeDefinition = (id, payload) => apiPatch(`/attributes/admin/definitions/${id}`, payload);
export const deleteAttributeDefinition = id => apiDelete(`/attributes/admin/definitions/${id}`);

export const fetchAttributeProfiles = () => apiGet("/attributes/admin/profiles");
export const createAttributeProfile = payload => apiPost("/attributes/admin/profiles", payload);
export const updateAttributeProfile = (id, payload) => apiPatch(`/attributes/admin/profiles/${id}`, payload);
export const deleteAttributeProfile = id => apiDelete(`/attributes/admin/profiles/${id}`);
export const assignCategoryAttributeProfile = (categoryId, attributeProfileId) =>
  apiPatch(`/attributes/admin/categories/${categoryId}/profile`, { attributeProfileId: attributeProfileId || null });
export const fetchEffectiveAttributeProfile = categoryId =>
  apiGet(`/attributes/admin/categories/${categoryId}/effective-profile`);
export const fetchProductAttributes = productId => apiGet(`/attributes/admin/products/${productId}`);
export const replaceProductAttributes = (productId, values) => apiPut(`/attributes/admin/products/${productId}`, { values });

export const fetchPublicAttributeFilters = category =>
  apiGet(`/attributes/category/${encodeURIComponent(category)}/filters`);
