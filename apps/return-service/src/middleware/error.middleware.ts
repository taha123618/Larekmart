import type { Context, Next } from "koa";
import { ZodError } from "zod";

export async function errorMiddleware(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      ctx.status = 400;
      ctx.body = {
        message: "Validation Error",
        errors: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      };
      return;
    }

    const message = err instanceof Error ? err.message : String(err);

    const status = (err as any).status || (err as any).statusCode;
    if (typeof status === "number" && status >= 400 && status < 600) {
      ctx.status = status;
      ctx.body = { message, statusCode: status };
      return;
    }

    if (
      message.includes("is currently in progress") ||
      message.includes("already in progress") ||
      message.includes("Inspection lock conflict") ||
      message.includes("conflict")
    ) {
      ctx.status = 409;
      ctx.body = { message, statusCode: 409 };
      return;
    }

    if (
      message.includes("Invalid return state transition") ||
      message.includes("not eligible") ||
      message.includes("Return window expired") ||
      message.includes("Evidence (photos/videos) is required") ||
      message.includes("Cannot submit tracking")
    ) {
      ctx.status = 400;
      ctx.body = { message };
      return;
    }

    if (message.includes("not found")) {
      ctx.status = 404;
      ctx.body = { message };
      return;
    }

    if (message.includes("Access denied")) {
      ctx.status = 403;
      ctx.body = { message };
      return;
    }

    console.error("[return-service] Unhandled Error:", err);
    ctx.status = 500;
    ctx.body = { message: "Internal Server Error" };
  }
}
