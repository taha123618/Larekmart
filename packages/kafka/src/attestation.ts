import crypto from "node:crypto";

export interface EventAttestationType {
  signature: string;
  timestamp: string;
  signer: string;
}

export interface AttestationPayloadInput {
  sessionId?: string | null;
  referenceId?: string | null;
  amount: number;
  userId?: string | null;
}

export interface VerifyAttestationInput extends AttestationPayloadInput {
  attestation?: EventAttestationType | null;
}

const DEFAULT_SECRET = "dev-shared-internal-secret-larekmart";

/**
 * Builds canonical string representation for cryptographic HMAC signing.
 */
function buildCanonicalAttestationPayload(
  data: AttestationPayloadInput,
  timestamp: string,
): string {
  const ref = data.sessionId || data.referenceId || "";
  const uid = data.userId || "";
  const amt = String(data.amount);
  return `${ref}|${amt}|${uid}|${timestamp}`;
}

/**
 * Creates an HMAC-SHA256 event attestation token for high-throughput asynchronous
 * payment verification across microservices without synchronous external API round-trips.
 */
export function createEventAttestation(
  data: AttestationPayloadInput,
  secret?: string,
  signer = "payment-service",
): EventAttestationType {
  const timestamp = new Date().toISOString();
  const signingSecret =
    secret || process.env.INTERNAL_SERVICE_SECRET || DEFAULT_SECRET;
  const canonical = buildCanonicalAttestationPayload(data, timestamp);

  const signature = crypto
    .createHmac("sha256", signingSecret)
    .update(canonical)
    .digest("hex");

  return {
    signature,
    timestamp,
    signer,
  };
}

/**
 * Verifies an HMAC-SHA256 event attestation token with constant-time equality check
 * and timestamp drift enforcement (default 5 minutes).
 */
export function verifyEventAttestation(
  data: VerifyAttestationInput,
  secret?: string,
  maxAgeMs = 300_000,
): { verified: boolean; reason?: string } {
  if (!data.attestation) {
    return { verified: false, reason: "Missing attestation block in payload" };
  }

  const { signature, timestamp } = data.attestation;
  if (!signature || !timestamp) {
    return {
      verified: false,
      reason: "Malformed attestation block: signature or timestamp missing",
    };
  }

  // Enforce timestamp freshness to prevent event replay attacks
  const eventTime = new Date(timestamp).getTime();
  if (isNaN(eventTime)) {
    return { verified: false, reason: "Invalid attestation timestamp format" };
  }

  const now = Date.now();
  if (Math.abs(now - eventTime) > maxAgeMs) {
    return {
      verified: false,
      reason: `Attestation expired or clock skewed beyond ${maxAgeMs}ms (drift: ${Math.abs(now - eventTime)}ms)`,
    };
  }

  const signingSecret =
    secret || process.env.INTERNAL_SERVICE_SECRET || DEFAULT_SECRET;
  const canonical = buildCanonicalAttestationPayload(data, timestamp);

  const expectedSignature = crypto
    .createHmac("sha256", signingSecret)
    .update(canonical)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");
    if (sigBuf.length !== expBuf.length) {
      return {
        verified: false,
        reason: "Attestation signature length mismatch",
      };
    }
    const match = crypto.timingSafeEqual(sigBuf, expBuf);
    if (!match) {
      return {
        verified: false,
        reason: "Attestation signature verification failed",
      };
    }
    return { verified: true };
  } catch (err) {
    return {
      verified: false,
      reason: `Attestation verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
