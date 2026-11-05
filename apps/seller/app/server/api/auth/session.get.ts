export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");
  const cookieToken = getCookie(event, "seller_session_token");

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieToken;

  if (!token) {
    return {
      authenticated: false,
      userId: null,
      session: null,
    };
  }

  try {
    const parts = token.split(".");
    if (parts.length === 3 && parts[1]) {
      const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
      const payload = JSON.parse(payloadJson) as {
        sub?: string;
        exp?: number;
        email?: string;
      };

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return {
          authenticated: false,
          userId: null,
          session: null,
          error: "Token expired",
        };
      }

      return {
        authenticated: true,
        userId: payload.sub || "user_mock",
        session: {
          id: payload.sub || "user_mock",
          email: payload.email || "seller@example.com",
        },
      };
    }

    return {
      authenticated: true,
      userId: "user_mock_dev",
      session: {
        id: "user_mock_dev",
        email: "seller@example.com",
      },
    };
  } catch (err: unknown) {
    return {
      authenticated: false,
      userId: null,
      session: null,
      error: err instanceof Error ? err.message : "Invalid session",
    };
  }
});
