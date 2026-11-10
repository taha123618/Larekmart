import { useAuthStore } from "~/stores/auth.store";

type NitroOptions = NonNullable<Parameters<typeof $fetch>[1]>;

export interface ApiFetchOptions extends Omit<NitroOptions, "headers" | "method"> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
}

export interface ApiError {
  statusCode: number;
  message: string;
  data?: unknown;
}

export function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const getBaseUrl = (): string => {
    // In client browser, call the public gateway URL (or local proxy)
    if (import.meta.client) {
      return (
        config.public?.apiGatewayUrl ||
        process.env.NUXT_PUBLIC_API_GATEWAY_URL ||
        "http://localhost:8090"
      );
    }
    // In SSR, call the internal gateway URL with dynamic env fallback
    return (
      process.env.API_GATEWAY_URL ||
      process.env.NUXT_API_GATEWAY_URL ||
      config.apiGatewayUrl ||
      config.public?.apiGatewayUrl ||
      "http://localhost:8090"
    );
  };

  const apiFetch = async <T>(
    endpoint: string,
    options: ApiFetchOptions = {},
  ): Promise<T> => {
    let cookieToken: string | null = null;
    try {
      if (typeof useCookie === "function") {
        cookieToken = useCookie("seller_session_token").value || null;
      }
    } catch {
      // In isolated environments or non-Nuxt test runners
    }

    const token = authStore.sessionToken || cookieToken;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const primaryBaseUrl = getBaseUrl();

    try {
      const response = await $fetch<T>(endpoint, {
        baseURL: primaryBaseUrl,
        ...options,
        headers,
      });
      return response;
    } catch (err: unknown) {
      // Dynamic fallback between 8090 (API Gateway) and 8080 (Traefik) or direct service
      const errStr = String(err);
      if (
        (errStr.includes("ECONNREFUSED") ||
          errStr.includes("fetch failed") ||
          errStr.includes("timeout") ||
          errStr.includes("TimeoutError") ||
          errStr.includes("aborted")) &&
        primaryBaseUrl.includes("8090")
      ) {
        try {
          return await $fetch<T>(endpoint, {
            baseURL: "http://localhost:8080",
            ...options,
            headers,
          });
        } catch {
          // If seller-service route, try port 8021 directly
          if (endpoint.startsWith("/api/v1/sellers")) {
            try {
              return await $fetch<T>(endpoint, {
                baseURL: "http://localhost:8021",
                ...options,
                headers,
              });
            } catch {
              // Continue to standard error handler
            }
          }
        }
      }
      const fetchErr = err as {
        response?: { status?: number; _data?: { message?: string } };
        message?: string;
      };
      const statusCode = fetchErr.response?.status || 500;
      const message =
        fetchErr.response?._data?.message ||
        fetchErr.message ||
        "An unexpected error occurred";

      if (statusCode === 401 && import.meta.client) {
        authStore.clearAuth();
        const router = useRouter();
        void router.push("/login");
      }

      const customError: ApiError = {
        statusCode,
        message,
        data: fetchErr.response?._data,
      };

      throw customError;
    }
  };

  return {
    apiFetch,
    get: <T>(url: string, opts?: ApiFetchOptions) =>
      apiFetch<T>(url, { ...opts, method: "GET" }),
    post: <T>(url: string, body?: ApiFetchOptions["body"], opts?: ApiFetchOptions) =>
      apiFetch<T>(url, { ...opts, method: "POST", body }),
    put: <T>(url: string, body?: ApiFetchOptions["body"], opts?: ApiFetchOptions) =>
      apiFetch<T>(url, { ...opts, method: "PUT", body }),
    patch: <T>(url: string, body?: ApiFetchOptions["body"], opts?: ApiFetchOptions) =>
      apiFetch<T>(url, { ...opts, method: "PATCH", body }),
    delete: <T>(url: string, opts?: ApiFetchOptions) =>
      apiFetch<T>(url, { ...opts, method: "DELETE" }),
  };
}
