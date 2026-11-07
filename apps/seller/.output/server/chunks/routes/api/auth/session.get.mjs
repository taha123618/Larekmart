import { d as defineEventHandler, g as getHeader, a as getCookie } from '../../../nitro/nitro.mjs';
import nodeCrypto from 'node:crypto';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:url';
import '@iconify/utils';
import 'consola';

function verifySellerJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { verified: false, claims: null, error: "Malformed JWT" };
  }
  const jwtKey = process.env.CLERK_JWT_KEY;
  const hmacKey = process.env.CLERK_JWT_HMAC_KEY;
  const signedData = `${parts[0]}.${parts[1]}`;
  let signature;
  try {
    signature = Buffer.from(parts[2], "base64url");
  } catch {
    return { verified: false, claims: null, error: "Invalid signature encoding" };
  }
  let verified = false;
  if (jwtKey && jwtKey.includes("-----BEGIN")) {
    try {
      const verifier = nodeCrypto.createVerify("RSA-SHA256");
      verifier.update(signedData);
      verified = verifier.verify(jwtKey, signature);
    } catch {
      verified = false;
    }
  } else if (hmacKey) {
    try {
      const expectedSig = nodeCrypto.createHmac("sha256", hmacKey).update(signedData).digest();
      verified = signature.length === expectedSig.length && nodeCrypto.timingSafeEqual(signature, expectedSig);
    } catch {
      verified = false;
    }
  } else {
    return { verified: false, claims: null, error: "Signing key not configured" };
  }
  if ((jwtKey || hmacKey) && !verified) {
    return { verified: false, claims: null, error: "Invalid token signature" };
  }
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
    const claims = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1e3);
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
const session_get = defineEventHandler(async (event) => {
  var _a;
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
    const verification = verifySellerJwt(token);
    if (!verification.verified || !((_a = verification.claims) == null ? void 0 : _a.sub)) {
      return {
        authenticated: false,
        userId: null,
        session: null,
        error: verification.error || "Authentication verification failed"
      };
    }
    return {
      authenticated: true,
      userId: verification.claims.sub,
      session: {
        id: verification.claims.sub,
        email: verification.claims.email || "seller@larekmart.com"
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
