import { d as defineEventHandler, g as getHeader, a as getCookie } from '../../../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@iconify/utils';
import 'consola';

const session_get = defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");
  const cookieToken = getCookie(event, "seller_session_token");
  const token = (authHeader == null ? void 0 : authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : cookieToken;
  if (!token) {
    return {
      authenticated: false,
      userId: null,
      session: null
    };
  }
  try {
    const parts = token.split(".");
    if (parts.length === 3 && parts[1]) {
      const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
      const payload = JSON.parse(payloadJson);
      if (payload.exp && payload.exp * 1e3 < Date.now()) {
        return {
          authenticated: false,
          userId: null,
          session: null,
          error: "Token expired"
        };
      }
      return {
        authenticated: true,
        userId: payload.sub || "user_mock",
        session: {
          id: payload.sub || "user_mock",
          email: payload.email || "seller@example.com"
        }
      };
    }
    return {
      authenticated: true,
      userId: "user_mock_dev",
      session: {
        id: "user_mock_dev",
        email: "seller@example.com"
      }
    };
  } catch (err) {
    return {
      authenticated: false,
      userId: null,
      session: null,
      error: err instanceof Error ? err.message : "Invalid session"
    };
  }
});

export { session_get as default };
//# sourceMappingURL=session.get.mjs.map
