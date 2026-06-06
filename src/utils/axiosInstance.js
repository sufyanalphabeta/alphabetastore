import axios from "axios";

const API_BASE_URL =
	(typeof window === "undefined" ? process.env.INTERNAL_API_BASE_URL?.trim() : undefined) ||
	process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
	"http://localhost:3001/api/v1";

/**
 * Strip the legacy `/api/` prefix that some Bazaar template files add to
 * endpoint paths.  All real API paths already start with a known resource
 * segment (e.g. /products, /categories), so we only remove the extra prefix
 * and leave everything else unchanged.
 */
function stripLegacyApiPrefix(url) {
	if (typeof url === "string" && url.startsWith("/api/")) {
		return url.replace(/^\/api/, "");
	}

	return url;
}

function unwrapEnvelope(data) {
	if (data && typeof data === "object" && data.success === true && "data" in data) {
		return data.data;
	}

	return data;
}

function normalizeAxiosError(error) {
	if (!error?.response) {
		const networkError = new Error("Server unavailable");
		networkError.code = error?.code;
		return networkError;
	}

	const payload = error.response.data;
	let message = "Failed to load data";

	if (typeof payload === "string") {
		message = payload;
	} else if (Array.isArray(payload?.message)) {
		message = payload.message.join(", ");
	} else if (typeof payload?.message === "string") {
		message = payload.message;
	}

	const requestError = new Error(message);
	requestError.status = error.response.status;
	requestError.code = payload?.errorCode || error.code;
	return requestError;
}

// Axios instance
const axiosInstance = axios.create({
	baseURL: API_BASE_URL
});

axiosInstance.interceptors.request.use(config => {
	config.url = stripLegacyApiPrefix(config.url);

	return config;
});

axiosInstance.interceptors.response.use(response => ({
	...response,
	data: unwrapEnvelope(response.data)
}), error => Promise.reject(normalizeAxiosError(error)));

export default axiosInstance;