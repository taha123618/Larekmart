import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const isZod =
    error instanceof ZodError ||
    error.name === "ZodError" ||
    (error as unknown as { issues?: unknown }).issues !== undefined;

  if (isZod) {
    const issues =
      (
        error as unknown as {
          issues?: Array<{ path: (string | number)[]; message: string }>;
        }
      ).issues ||
      (
        error as unknown as {
          errors?: Array<{ path: (string | number)[]; message: string }>;
        }
      ).errors ||
      [];
    reply.status(400).send({
      message: "Validation failed",
      errors: issues.map((e) => ({
        path: Array.isArray(e.path) ? e.path.join(".") : String(e.path),
        message: e.message,
      })),
    });
    return;
  }

  const statusCode =
    typeof error.statusCode === "number" ? error.statusCode : 500;
  const message = error.message || "Internal server error";

  if (statusCode >= 500) {
    console.error("[SellerService Error]", error);
  }

  reply.status(statusCode).send({
    message,
  });
}
