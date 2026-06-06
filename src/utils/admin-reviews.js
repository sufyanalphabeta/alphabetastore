import { apiGet, apiPatch } from "./api";

export async function adminFetchReviews({ status, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet(`/admin/reviews?${params}`);
}

export async function adminModerateReview(reviewId, { status, moderatorNote }) {
  return apiPatch(`/admin/reviews/${reviewId}/moderate`, { status, moderatorNote });
}

export async function adminFetchQnA({ status, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  return apiGet(`/admin/qna?${params}`);
}

export async function adminAnswerQuestion(questionId, answer) {
  return apiPatch(`/admin/qna/${questionId}/answer`, { answer });
}

export async function adminHideQuestion(questionId) {
  return apiPatch(`/admin/qna/${questionId}/hide`, {});
}
