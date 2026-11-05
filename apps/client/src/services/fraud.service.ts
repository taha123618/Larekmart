/**
 * fraud.service.ts — Client-side device telemetry and risk context provider.
 * Collects privacy-preserving client entropy (device fingerprint, screen dimensions,
 * timezone, locale) to supply downstream fraud detection without collecting PII.
 */

let _cachedFingerprint: string | null = null;

/**
 * Fast 32-bit FNV-1a hash implementation
 */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ("0000000" + (hash >>> 0).toString(16)).slice(-8);
}

/**
 * Returns a deterministic, privacy-preserving device fingerprint string for the browser session.
 */
export function getDeviceFingerprint(): string {
  if (_cachedFingerprint) {
    return _cachedFingerprint;
  }

  if (typeof window === "undefined") {
    return "server-ssr";
  }

  try {
    const sessionKey = "lm_dfp_v1";
    const stored = window.sessionStorage?.getItem(sessionKey);
    if (stored) {
      _cachedFingerprint = stored;
      return stored;
    }

    const screenData = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
    const timezone =
      Intl?.DateTimeFormat?.().resolvedOptions()?.timeZone || "UTC";
    const language = window.navigator?.language || "en";
    const cores = window.navigator?.hardwareConcurrency || 2;
    const userAgent = window.navigator?.userAgent || "browser";

    const entropy = [screenData, timezone, language, cores, userAgent].join(
      "|",
    );
    const fp = `dfp_${fnv1a(entropy)}${fnv1a(entropy.split("").reverse().join(""))}`;

    window.sessionStorage?.setItem(sessionKey, fp);
    _cachedFingerprint = fp;
    return fp;
  } catch {
    return "dfp_anonymous_client";
  }
}

export interface ClientRiskContext {
  deviceFingerprint: string;
  screenResolution: string;
  timezone: string;
  language: string;
  timestamp: string;
}

/**
 * Collects client risk telemetry for checkout and order verification
 */
export function getClientRiskContext(): ClientRiskContext {
  const fp = getDeviceFingerprint();

  if (typeof window === "undefined") {
    return {
      deviceFingerprint: fp,
      screenResolution: "1920x1080",
      timezone: "UTC",
      language: "en",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    deviceFingerprint: fp,
    screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions()?.timeZone || "UTC",
    language: window.navigator?.language || "en",
    timestamp: new Date().toISOString(),
  };
}
