import { getAuth } from "@hono/clerk-auth";
import { createMiddleware } from "hono/factory";
import type { CustomJwtSessionClaims } from "@repo/types";

export type AuthVariables = {
  userId: string;
};

export const shouldBeUser = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    c.set("userId", auth.userId);
    await next();
  },
);

export const shouldBeAdmin = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const auth = getAuth(c);
    if (!auth?.userId) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = auth.sessionClaims as CustomJwtSessionClaims;
    if (claims.metadata?.role !== "admin") {
      return c.json({ message: "Unauthorized!" }, 403);
    }

    c.set("userId", auth.userId);
    await next();
  },
);
