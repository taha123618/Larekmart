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
