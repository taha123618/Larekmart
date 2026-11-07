import { describe, it, expect } from "vitest";

interface NormalizedApiError {
  message: string;
  statusCode: number;
  details?: unknown;
}

function normalizeApiError(err: unknown): NormalizedApiError {
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    const statusCode = typeof obj.status === "number" ? obj.status : typeof obj.statusCode === "number" ? obj.statusCode : 500;
    const data = obj.data as Record<string, unknown> | undefined;
    const message = (typeof data?.message === "string" && data.message) || (typeof obj.message === "string" && obj.message) || "An unexpected error occurred";
    return {
      message,
      statusCode,
      details: data?.details || data?.error || undefined,
    };
  }
  return {
    message: String(err) || "An unexpected error occurred",
    statusCode: 500,
  };
}

describe("API Error Normalization Helper", () => {
  it("normalizes structured Fastify/Express backend error responses", () => {
    const mockHttpError = {
      status: 409,
      data: {
        message: "Store slug is already in use",
        details: { field: "slug", conflict: "tech-gear" },
      },
    };

    const normalized = normalizeApiError(mockHttpError);
    expect(normalized.statusCode).toBe(409);
    expect(normalized.message).toBe("Store slug is already in use");
    expect(normalized.details).toEqual({ field: "slug", conflict: "tech-gear" });
  });

  it("handles 401 unauthenticated errors cleanly", () => {
    const unauthError = {
      statusCode: 401,
      message: "Authentication required",
    };

    const normalized = normalizeApiError(unauthError);
    expect(normalized.statusCode).toBe(401);
    expect(normalized.message).toBe("Authentication required");
  });

  it("safely falls back for non-object throws", () => {
    const normalized = normalizeApiError("Network timeout");
    expect(normalized.statusCode).toBe(500);
    expect(normalized.message).toBe("Network timeout");
  });
});
