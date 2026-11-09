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
        config.public?.apiGatewayUrl
      ].filter(Boolean) as string[],
    ),
  );

  let gatewayResponse: GatewayLoginResponse | null = null;
  let lastError: { statusCode?: number; statusMessage?: string } | null = null;

  // Authoritative merchant login via API Gateway -> seller-service
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
          timeout: 8000,
        },
      );

      if (gatewayResponse?.success && gatewayResponse.token) {
        break; // Successfully authenticated via API Gateway
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
    statusCode: lastError?.statusCode || 502,
    statusMessage:
      lastError?.statusMessage ||
      "API Gateway authentication service unavailable",
  });
});
