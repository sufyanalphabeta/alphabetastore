import { apiGet, apiPost } from './api';

export const fetchActivityPresets = () => apiGet('/admin/activity/presets');
export const previewActivityPreset = (code = 'ELECTRONICS_COMPUTERS') => apiGet(`/admin/activity/preview?code=${encodeURIComponent(code)}`);
export const applyActivityPreset = (code = 'ELECTRONICS_COMPUTERS') => apiPost(`/admin/activity/apply?code=${encodeURIComponent(code)}`, {});
