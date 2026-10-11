import type { GatewayErrorCode } from "../schemas/errors.js";

export class GatewayError extends Error {
  public readonly statusCode: number;
  public readonly code: GatewayErrorCode;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode = 500,
    code: GatewayErrorCode = "INTERNAL_SERVER_ERROR",
    requestId?: string,
  ) {
    super(message);
    this.name = "GatewayError";
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends GatewayError {
  constructor(message = "Bad Request", requestId?: string) {
    super(message, 400, "BAD_REQUEST", requestId);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends GatewayError {
  constructor(
    message = "Authentication required to access this resource",
    requestId?: string,
  ) {
    super(message, 401, "UNAUTHORIZED", requestId);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends GatewayError {
  constructor(message = "Forbidden", requestId?: string) {
    super(message, 403, "FORBIDDEN", requestId);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends GatewayError {
  constructor(message = "Resource not found", requestId?: string) {
    super(message, 404, "NOT_FOUND", requestId);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends GatewayError {
  constructor(
    message = "Rate limit exceeded. Please try again later.",
    requestId?: string,
  ) {
    super(message, 429, "RATE_LIMITED", requestId);
    this.name = "RateLimitError";
  }
}

export class TimeoutError extends GatewayError {
  constructor(message = "Request timed out", requestId?: string) {
    super(message, 408, "REQUEST_TIMEOUT", requestId);
    this.name = "TimeoutError";
  }
}

export class BadGatewayError extends GatewayError {
  constructor(
    message = "Bad Gateway: Invalid response from upstream microservice",
    requestId?: string,
  ) {
    super(message, 502, "BAD_GATEWAY", requestId);
    this.name = "BadGatewayError";
  }
}

export class ServiceUnavailableError extends GatewayError {
  constructor(
    message = "The requested microservice is temporarily unavailable",
    requestId?: string,
  ) {
    super(message, 503, "SERVICE_UNAVAILABLE", requestId);
    this.name = "ServiceUnavailableError";
  }
}

export class GatewayTimeoutError extends GatewayError {
  constructor(
    message = "The upstream microservice did not respond in time",
    requestId?: string,
  ) {
    super(message, 504, "GATEWAY_TIMEOUT", requestId);
    this.name = "GatewayTimeoutError";
  }
}
