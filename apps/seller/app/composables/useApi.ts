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
      return config.public.apiGatewayUrl || "http://localhost:8080";
    }
    // In SSR, call the internal gateway URL
    return config.apiGatewayUrl || "http://localhost:8090";
  };

  const apiFetch = async <T>(
    endpoint: string,
    options: ApiFetchOptions = {},
  ): Promise<T> => {
    const token =
      authStore.sessionToken ||
      (import.meta.client ? useCookie("seller_session_token").value : null);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await $fetch<T>(endpoint, {
        baseURL: getBaseUrl(),
        ...options,
        headers,
      });
      return response;
    } catch (err: unknown) {
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
