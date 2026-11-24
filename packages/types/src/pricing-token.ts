import { createHmac, timingSafeEqual } from "node:crypto";
import type { SignedPriceQuotePayload } from "./pricing.js";

export const DEFAULT_PRICING_QUOTE_SECRET =
  process.env.PRICING_QUOTE_SECRET ||
  "larekmart_internal_pricing_quote_secret_2026_dev";

/**
 * Creates an HMAC-SHA256 signature for a base64url-encoded payload.
 */
function createSignature(payloadBase64Url: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payloadBase64Url)
    .digest("base64url");
}

/**
 * Signs an immutable Price Quote payload into a compact, tamper-proof token.
 * Format: `<base64urlPayload>.<base64urlHmacSignature>`
 */
export function signPriceQuoteToken(
  payload: SignedPriceQuotePayload,
  secret = DEFAULT_PRICING_QUOTE_SECRET,
): string {
  const jsonStr = JSON.stringify(payload);
  const payloadBase64Url = Buffer.from(jsonStr, "utf8").toString("base64url");
  const signature = createSignature(payloadBase64Url, secret);
  return `${payloadBase64Url}.${signature}`;
}

export type VerifyPriceQuoteResult =
  | { valid: true; payload: SignedPriceQuotePayload }
  | {
      valid: false;
      reason:
        | "INVALID_FORMAT"
        | "INVALID_SIGNATURE"
        | "EXPIRED"
        | "MALFORMED_PAYLOAD";
    };

/**
 * Verifies and decodes a signed price quote token in 0 DB hops and constant time.
 */
export function verifyPriceQuoteToken(
  token: string,
  secret = DEFAULT_PRICING_QUOTE_SECRET,
  nowMs = Date.now(),
): VerifyPriceQuoteResult {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  const payloadBase64Url = parts[0];
  const providedSignature = parts[1];

  // Compute expected HMAC signature
  const expectedSignature = createSignature(payloadBase64Url, secret);

  const providedBuf = Buffer.from(providedSignature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  let payload: SignedPriceQuotePayload;
  try {
    const jsonStr = Buffer.from(payloadBase64Url, "base64url").toString("utf8");
    payload = JSON.parse(jsonStr) as SignedPriceQuotePayload;
  } catch {
    return { valid: false, reason: "MALFORMED_PAYLOAD" };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.items) ||
    typeof payload.expiresAt !== "number"
  ) {
    return { valid: false, reason: "MALFORMED_PAYLOAD" };
  }

  if (payload.expiresAt <= nowMs) {
    return { valid: false, reason: "EXPIRED" };
  }

  return { valid: true, payload };
}
