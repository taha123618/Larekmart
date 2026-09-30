import { AppError } from "@repo/monitoring";

/**
 * Domain error hierarchy for media-service. Every error carries a stable
 * HTTP status and a safe message. The Hono error handler maps these to
 * JSON responses; anything unexpected is logged and returned as 500
 * without internals.
 */
export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, { statusCode: 400, code: "VALIDATION_ERROR", details });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You are not logged in.") {
    super(message, { statusCode: 401, code: "UNAUTHORIZED" });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to access this media.") {
    super(message, { statusCode: 403, code: "FORBIDDEN" });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Media not found") {
    super(message, { statusCode: 404, code: "NOT_FOUND" });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicting media operation") {
    super(message, { statusCode: 409, code: "CONFLICT" });
    this.name = "ConflictError";
  }
}

export class UploadError extends AppError {
  constructor(message = "Upload failed") {
    super(message, { statusCode: 400, code: "UPLOAD_ERROR" });
    this.name = "UploadError";
  }
}

export class StorageError extends AppError {
  constructor(message = "Storage operation failed") {
    super(message, { statusCode: 502, code: "STORAGE_ERROR" });
    this.name = "StorageError";
  }
}

export class ProcessingError extends AppError {
  constructor(message = "Media processing failed") {
    super(message, { statusCode: 500, code: "PROCESSING_ERROR" });
    this.name = "ProcessingError";
  }
}

export class MediaTypeNotSupportedError extends AppError {
  constructor(message = "Media type is not supported") {
    super(message, { statusCode: 415, code: "MEDIA_TYPE_NOT_SUPPORTED" });
    this.name = "MediaTypeNotSupportedError";
  }
}

export class MediaTooLargeError extends AppError {
  constructor(message = "Media exceeds the allowed size for its category") {
    super(message, { statusCode: 413, code: "MEDIA_TOO_LARGE" });
    this.name = "MediaTooLargeError";
  }
}

export class MediaNotReadyError extends AppError {
  constructor(message = "Media is not ready yet") {
    super(message, { statusCode: 409, code: "MEDIA_NOT_READY" });
    this.name = "MediaNotReadyError";
  }
}
