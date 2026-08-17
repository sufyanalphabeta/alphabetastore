import { clearTokens, getAccessToken, getRefreshToken, saveAccessToken } from "./auth";
import { ensureCartSessionId } from "./cart";

const DEFAULT_API_BASE_URL = "http://localhost:3001/api/v1";

export const API_BASE_URL =
  (typeof window === "undefined" ? process.env.INTERNAL_API_BASE_URL?.trim() : undefined) ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  DEFAULT_API_BASE_URL;

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: ApiMethod;
  body?: unknown;
  retryOnUnauthorized?: boolean;
};

type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

type ErrorEnvelope = {
  success: false;
  errorCode?: string;
  message?: string | string[];
};

type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

let refreshRequest: Promise<string | null> | null = null;

function isApiEnvelope(payload: unknown): payload is ApiEnvelope<unknown> {
  return !!payload && typeof payload === "object" && "success" in payload;
}

function unwrapSuccessData<T>(payload: unknown): T | unknown {
  if (isApiEnvelope(payload) && payload.success) {
    return payload.data;
  }

  return payload;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") {
    return payload;
  }

  if (isApiEnvelope(payload) && !payload.success) {
    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(", ");
    }
  }

  return fallback;
}

function getErrorCode(payload: unknown) {
  if (isApiEnvelope(payload) && !payload.success && typeof payload.errorCode === "string") {
    return payload.errorCode;
  }

  if (payload && typeof payload === "object" && "errorCode" in payload) {
    const errorCode = (payload as { errorCode?: unknown }).errorCode;
    return typeof errorCode === "string" ? errorCode : undefined;
  }

  return undefined;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function buildHeaders(method: ApiMethod, token?: string | null, body?: unknown) {
  const headers: Record<string, string> = {};
  const sessionId = ensureCartSessionId();

  if ((method === "POST" || method === "PATCH") && !isFormData(body)) {
    headers["Content-Type"] = "application/json";
  }

  if (sessionId) {
    headers["x-session-id"] = sessionId;
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    headers["x-request-id"] = crypto.randomUUID();
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ refreshToken }),
      });

      const data = await parseJsonResponse(response);

      const normalizedData = unwrapSuccessData<{ accessToken?: string }>(data) as {
        accessToken?: string;
      } | null;

      if (!response.ok || !normalizedData?.accessToken) {
        clearTokens();
        return null;
      }

      saveAccessToken(normalizedData.accessToken);
      return normalizedData.accessToken;
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

export async function apiRequest(path: string, options: RequestOptions = {}) {
  const { method = "GET", body, retryOnUnauthorized = true } = options;
  const token = getAccessToken();
  const headers = buildHeaders(method, token, body);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    cache: "no-store",
    body: body ? isFormData(body) ? body : JSON.stringify(body) : undefined,
  });

  const data = await parseJsonResponse(response);

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    path !== "/auth/refresh" &&
    path !== "/auth/login"
  ) {
    const nextAccessToken = await refreshAccessToken();

    if (nextAccessToken) {
      return apiRequest(path, {
        method,
        body,
        retryOnUnauthorized: false,
      });
    }
  }

  if (!response.ok) {
    const error = new Error(getErrorMessage(data, "Request failed")) as Error & {
      code?: string;
      status?: number;
    };
    error.code = getErrorCode(data);
    error.status = response.status;
    throw error;
  }

  return unwrapSuccessData(data);
}

export function apiGet(path: string) {
  return apiRequest(path, { method: "GET" });
}

export function apiPost(path: string, body: unknown) {
  return apiRequest(path, { method: "POST", body });
}

export function apiPatch(path: string, body: unknown) {
  return apiRequest(path, { method: "PATCH", body });
}

export function apiPut(path: string, body: unknown) {
  return apiRequest(path, { method: "PUT", body });
}

export function apiDelete(path: string) {
  return apiRequest(path, { method: "DELETE" });
}
