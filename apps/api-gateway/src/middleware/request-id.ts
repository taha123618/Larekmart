import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";

const FORBIDDEN_CLIENT_HEADERS = [
  "x-user-id",
  "x-user-role",
  "x-user-permissions",
  "x-internal-secret",
] as const;

export function registerRequestIdMiddleware(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request, reply) => {
    // 1. Strip untrusted client-supplied identity & internal headers
    for (const header of FORBIDDEN_CLIENT_HEADERS) {
      delete request.headers[header];
    }

    // 2. Correlate or generate request ID
    const incomingId = request.headers["x-request-id"];
    const requestId =
      typeof incomingId === "string" && incomingId.trim().length > 0
        ? incomingId.trim()
        : uuidv4();

    request.headers["x-request-id"] = requestId;
    reply.header("x-request-id", requestId);
  });
}
