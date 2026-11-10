interface GatewayLoginResponse {
  success: boolean;
  token: string;
  userId: string;
  seller: {
    id: string;
    vendorId: string;
    storeName: string;
    slug: string;
    status: string;
  };
  user: {
    id: string;
    email: string;
    fullName: string;
    role?: string;
  };
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const email = (body?.email || "").trim();
  const password = body?.password || "";
  const rememberMe = body?.rememberMe ?? true;

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Merchant email address is required",
    });
  }

  const config = useRuntimeConfig();

  // Dynamically resolve candidate URLs across environment variables and configs
  const candidateUrls = Array.from(
    new Set(
      [
        process.env.API_GATEWAY_URL,
        process.env.NUXT_API_GATEWAY_URL,
        config.apiGatewayUrl,
        config.public?.apiGatewayUrl,
        "http://localhost:8090",
        "http://localhost:8080",
        process.env.SELLER_SERVICE_URL,
        "http://localhost:8021",
      ].filter(Boolean) as string[],
    ),
  );

  let gatewayResponse: GatewayLoginResponse | null = null;
  let lastError: { statusCode?: number; statusMessage?: string } | null = null;

  // Authoritative merchant login via API Gateway -> seller-service fallback
  for (const url of candidateUrls) {
    try {
      gatewayResponse = await $fetch<GatewayLoginResponse>(
        `${url}/api/v1/sellers/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: {
            email,
            password,
            rememberMe,
          },
          timeout: 3000,
        },
      );

      if (gatewayResponse?.success && gatewayResponse.token) {
        break; // Successfully authenticated via API Gateway or direct service
      }
    } catch (err: unknown) {
      const fetchErr = err as {
        statusCode?: number;
        status?: number;
        data?: { message?: string; error?: string };
        message?: string;
      };

      const status = fetchErr?.statusCode || fetchErr?.status || 500;
      const message =
        fetchErr?.data?.message ||
        fetchErr?.data?.error ||
        fetchErr?.message ||
        "Invalid merchant credentials";

      lastError = { statusCode: status, statusMessage: message };

      // Propagate client authentication failures (400, 401, 403, 404) immediately
      if (status >= 400 && status < 500) {
        throw createError({
          statusCode: status,
          statusMessage: message,
        });
      }
    }
  }

  // Set session cookie and return gateway response
  if (gatewayResponse?.success && gatewayResponse.token) {
    setCookie(event, "seller_session_token", gatewayResponse.token, {
      maxAge: rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      path: "/",
    });

    return gatewayResponse;
  }

  throw createError({
    statusCode:
      lastError?.statusCode && lastError.statusCode < 500
        ? lastError.statusCode
        : 503,
    statusMessage:
      lastError?.statusCode && lastError.statusCode < 500
        ? lastError.statusMessage
        : "Backend authentication service is unavailable. Please ensure API Gateway (port 8090) or seller-service (port 8021) is running.",
  });
});
