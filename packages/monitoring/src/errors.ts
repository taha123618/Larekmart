import type { Logger } from "./logger.js";
import type { MetricsRegistry } from "./metrics.js";

export interface FormattedError {
  name: string;
  message: string;
  code?: string | number;
  statusCode?: number;
  isOperational: boolean;
  stack?: string;
  details?: unknown;
  timestamp: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      isOperational?: boolean;
      code?: string;
      details?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    this.code = options.code;
    this.details = options.details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Normalizes an unknown thrown value into a standardized FormattedError object.
 */
export function formatError(err: unknown): FormattedError {
  const timestamp = new Date().toISOString();

  if (err instanceof AppError) {
    return {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
      isOperational: err.isOperational,
      details: err.details,
      stack: err.stack,
      timestamp,
    };
  }

  if (err instanceof Error) {
    const errorObj = err as Error & {
      code?: string | number;
      statusCode?: number;
      status?: number;
    };
    return {
      name: err.name,
      message: err.message,
      statusCode: errorObj.statusCode || errorObj.status || 500,
      code: errorObj.code,
      isOperational: false,
      stack: err.stack,
      timestamp,
    };
  }

  return {
    name: "UnknownError",
    message: typeof err === "string" ? err : JSON.stringify(err),
    statusCode: 500,
    isOperational: false,
    timestamp,
  };
}

/**
 * Checks whether an error is marked as operational (predictable business error vs unexpected crash).
 */
export function isOperationalError(err: unknown): boolean {
  if (err instanceof AppError) {
    return err.isOperational;
  }
  return false;
}

/**
 * Captures and logs an error to structured logging and metric counters.
 */
export function captureError(
  err: unknown,
  context: {
    serviceName?: string;
    logger?: Logger;
    metrics?: MetricsRegistry;
    requestId?: string;
    userId?: string;
    route?: string;
    context?: string;
    metadata?: Record<string, unknown>;
  } = {},
): FormattedError {
  const formatted = formatError(err);

  if (context.metrics) {
    context.metrics.increment("errors_total", 1, {
      error_name: formatted.name,
      status_code: formatted.statusCode ?? 500,
      operational: String(formatted.isOperational),
    });
  }

  if (context.logger) {
    const errorObj = err instanceof Error ? err : undefined;
    const metadata = {
      ...context.metadata,
      context: context.context,
      requestId: context.requestId,
      userId: context.userId,
      route: context.route,
      statusCode: formatted.statusCode,
      code: formatted.code,
      isOperational: formatted.isOperational,
    };

    if (formatted.isOperational) {
      context.logger.warn(
        `[Operational Error] ${formatted.name}: ${formatted.message}`,
        metadata,
        errorObj,
      );
    } else {
      context.logger.error(
        `[Fatal/System Error] ${formatted.name}: ${formatted.message}`,
        errorObj,
        metadata,
      );
    }
  }

  return formatted;
}
