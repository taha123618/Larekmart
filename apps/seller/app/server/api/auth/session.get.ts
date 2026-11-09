import crypto from "node:crypto";

interface JwtClaims {
  sub?: string;
  exp?: number;
  nbf?: number;
  email?: string;
  role?: string;
  metadata?: { role?: string; isSeller?: boolean };
}

function verifySellerJwt(token: string): {
  verified: boolean;
  claims: JwtClaims | null;
  error?: string;
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { verified: false, claims: null, error: "Malformed JWT" };
  }

  const jwtKey = process.env.CLERK_JWT_KEY;
  const hmacKey = process.env.CLERK_JWT_HMAC_KEY;
  const isTest = process.env.NODE_ENV === "test";
  const isDev = process.env.NODE_ENV === "development";

  const signedData = `${parts[0]}.${parts[1]}`;
  let signature: Buffer;
  try {
    signature = Buffer.from(parts[2]!, "base64url");
  } catch {
    return { verified: false, claims: null, error: "Invalid signature encoding" };
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
      verified =
        signature.length === expectedSig.length &&
        crypto.timingSafeEqual(signature, expectedSig);
    } catch {
      verified = false;
    }
  } else if (!isTest && !isDev) {
    // Fail closed in production when no signing key is configured
    return { verified: false, claims: null, error: "Signing key not configured" };
  }

  // If a key was provided and verification failed, strictly reject
  if ((jwtKey || hmacKey) && !verified) {
    return { verified: false, claims: null, error: "Invalid token signature" };
  }

  try {
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf-8");
    const claims = JSON.parse(payloadJson) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && now >= claims.exp) {
      return { verified: false, claims: null, error: "Token expired" };
    }
    if (claims.nbf && now < claims.nbf) {
      return { verified: false, claims: null, error: "Token not yet active" };
    }
    return { verified: true, claims };
  } catch {
    return { verified: false, claims: null, error: "Failed to parse token payload" };
  }
}

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
    const verification = verifySellerJwt(token);
    if (!verification.verified || !verification.claims?.sub) {
      return {
        authenticated: false,
        userId: null,
        session: null,
        error: verification.error || "Authentication verification failed",
      };
    }

    return {
      authenticated: true,
      userId: verification.claims.sub,
      session: {
        id: verification.claims.sub,
        email: verification.claims.email || "",
        role: verification.claims.role || "seller",
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
