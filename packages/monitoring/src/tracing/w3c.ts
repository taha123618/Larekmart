import { randomBytes } from "node:crypto";

export interface ParsedTraceparent {
  version: string;
  traceId: string;
  parentId: string;
  traceFlags: string;
  sampled: boolean;
}

const TRACEPARENT_REGEX = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const ALL_ZERO_TRACE_ID = "00000000000000000000000000000000";
const ALL_ZERO_PARENT_ID = "0000000000000000";

/**
 * Generates a standard W3C 16-byte (32-character hex) trace ID.
 */
export function generateTraceId(): string {
  let id = randomBytes(16).toString("hex").toLowerCase();
  while (id === ALL_ZERO_TRACE_ID) {
    id = randomBytes(16).toString("hex").toLowerCase();
  }
  return id;
}

/**
 * Generates a standard W3C 8-byte (16-character hex) span/parent ID.
 */
export function generateSpanId(): string {
  let id = randomBytes(8).toString("hex").toLowerCase();
  while (id === ALL_ZERO_PARENT_ID) {
    id = randomBytes(8).toString("hex").toLowerCase();
  }
  return id;
}

/**
 * Parses an incoming W3C traceparent header.
 * Example: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
 */
export function parseTraceparent(header?: string | null): ParsedTraceparent | null {
  if (!header || typeof header !== "string") return null;
  const trimmed = header.trim();
  const match = TRACEPARENT_REGEX.exec(trimmed);
  if (!match) return null;

  const version = match[1]!.toLowerCase();
  const traceId = match[2]!.toLowerCase();
  const parentId = match[3]!.toLowerCase();
  const traceFlags = match[4]!.toLowerCase();

  // Version 00 cannot have all zeroes for trace ID or parent ID
  if (version === "00" && (traceId === ALL_ZERO_TRACE_ID || parentId === ALL_ZERO_PARENT_ID)) {
    return null;
  }

  const sampled = (parseInt(traceFlags, 16) & 0x01) === 0x01;

  return {
    version,
    traceId,
    parentId,
    traceFlags,
    sampled,
  };
}

/**
 * Formats a valid W3C traceparent header string.
 */
export function createTraceparent(
  traceId: string = generateTraceId(),
  parentId: string = generateSpanId(),
  sampled = true,
): string {
  const flags = sampled ? "01" : "00";
  return `00-${traceId}-${parentId}-${flags}`;
}
