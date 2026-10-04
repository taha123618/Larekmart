import { logger } from "../observability/logger.js";
import { gatewayProxyRetriesTotal } from "../observability/metrics.js";

const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TRANSIENT_ERROR_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"]);

export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number;
  isIdempotent?: boolean;
}

export function isRetryable(
  method: string,
  error: Error & { code?: string },
  options: RetryOptions = {},
): boolean {
  const isMethodSafe = SAFE_HTTP_METHODS.has(method.toUpperCase());
  if (!isMethodSafe && !options.isIdempotent) {
    return false;
  }

  if (error.code && TRANSIENT_ERROR_CODES.has(error.code)) {
    return true;
  }

  return false;
}

export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  method: string,
  serviceName: string,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? (SAFE_HTTP_METHODS.has(method.toUpperCase()) ? 2 : 0);
  const backoffMs = options.backoffMs ?? 150;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      const errorObj = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries && isRetryable(method, errorObj as Error & { code?: string }, options)) {
        gatewayProxyRetriesTotal.inc({ service: serviceName, method });
        logger.warn(`Retrying transient error for ${serviceName} (attempt ${attempt + 1}/${maxRetries})`, {
          service: serviceName,
          method,
          attempt: attempt + 1,
          error: errorObj.message,
        });

        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
