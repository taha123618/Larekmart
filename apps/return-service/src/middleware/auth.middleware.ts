import crypto from "crypto";
import type { Context, Next } from "koa";
import { env } from "../config/env.js";

/**
 * Constant-time comparison using SHA-256 hash digests to prevent timing attacks
 */
export function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Validates internal service secret provided by API Gateway
 */
export function isInternalService(ctx: Context): boolean {
  const secret = ctx.headers["x-internal-secret"];
  if (typeof secret !== "string") {
    return false;
  }
  return safeTimingCompare(secret, env.GATEWAY_INTERNAL_SECRET);
}

interface JwtClaims {
  sub?: string;
  userId?: string;
  exp?: number;
  nbf?: number;
  role?: string;
  metadata?: { role?: string };
}

function verifyJwtToken(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const jwtKey = process.env.CLERK_JWT_KEY;
  // The Clerk secret key is NOT an HMAC signing key. Symmetric verification is
  // only available through an explicit fixture key (tests/local harnesses).
  const hmacKey = process.env.CLERK_JWT_HMAC_KEY;
  const nodeEnv = process.env.NODE_ENV || env.NODE_ENV;
  const isTest = nodeEnv === "test";

  const signedData = `${parts[0]}.${parts[1]}`;
  let signature: Buffer;
  try {
    signature = Buffer.from(parts[2]!, "base64url");
  } catch {
    return null;
  }

  let verified = false;
  if (jwtKey && jwtKey.includes("-----BEGIN")) {
    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(signedData);
      verified = verifier.verify(jwtKey, signature);
    } catch {
      verified = false;
    }
  } else if (hmacKey) {
    try {
      const expectedSig = crypto
        .createHmac("sha256", hmacKey)
        .update(signedData)
        .digest();
      const sigHash = crypto.createHash("sha256").update(signature).digest();
      const expectedHash = crypto
        .createHash("sha256")
        .update(expectedSig)
        .digest();
      verified = crypto.timingSafeEqual(sigHash, expectedHash);
    } catch {
      verified = false;
    }
  } else if (!isTest) {
    // Fail closed in production AND development when no key is configured.
    return null;
  }

  if ((jwtKey || hmacKey) && !verified) return null;

  try {
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const claims = JSON.parse(payloadJson) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);

    if (typeof claims.exp !== "number" || claims.exp <= now) return null;
    if (typeof claims.nbf === "number" && claims.nbf > now + 30) return null;

    return claims;
  } catch {
    return null;
  }
}

/**
 * Authenticates user from gateway forwarded headers or Bearer JWT token
 */
export async function shouldBeUser(ctx: Context, next: Next): Promise<void> {
  // 1. Gateway forwarded identity (trusted only if valid internal secret is present)
  if (isInternalService(ctx)) {
    const userIdHeader = ctx.headers["x-user-id"];
    if (typeof userIdHeader === "string" && userIdHeader.trim()) {
      ctx.state.userId = userIdHeader.trim();
      ctx.state.userRole =
        typeof ctx.headers["x-user-role"] === "string"
          ? ctx.headers["x-user-role"]
          : "user";
      return next();
    }
  }

  // 2. Direct Bearer token verification
  const authHeader = ctx.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const claims = verifyJwtToken(token);
    if (claims && (claims.sub || claims.userId)) {
      ctx.state.userId = claims.sub || claims.userId;
      ctx.state.userRole = claims.metadata?.role || claims.role || "user";
      return next();
    }
  }

  ctx.status = 401;
  ctx.body = { message: "Unauthorized: Customer authentication required" };
}

/**
 * Guard requiring either verified admin role or internal gateway secret
 */
export async function shouldBeAdmin(ctx: Context, next: Next): Promise<void> {
  // 1. If request contains valid internal service secret signed by API gateway
  if (isInternalService(ctx)) {
    const userRole = ctx.headers["x-user-role"];
    const userId = ctx.headers["x-user-id"];
    if (userRole === "admin") {
      ctx.state.userId = typeof userId === "string" ? userId : "admin-gateway";
      ctx.state.userRole = "admin";
      return next();
    }
    // In test environment, if internal secret is matched, allow admin access
    if (env.NODE_ENV === "test") {
      ctx.state.userId = typeof userId === "string" ? userId : "test-admin";
      ctx.state.userRole = "admin";
      return next();
    }
  }

  // 2. Direct Bearer token verification
  const authHeader = ctx.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const claims = verifyJwtToken(token);
    if (claims) {
      const role = claims.metadata?.role || claims.role;
      if (role === "admin") {
        ctx.state.userId = claims.sub || "admin-user";
        ctx.state.userRole = "admin";
        return next();
      }
    }
  }

  ctx.status = 403;
  ctx.body = { message: "Forbidden: Administrator privileges required" };
}
