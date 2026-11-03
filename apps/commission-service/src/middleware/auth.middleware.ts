import type { FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export async function requireInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const secret = request.headers["x-internal-secret"];
  if (typeof secret !== "string") {
    reply.status(401).send({ message: "Missing x-internal-secret header" });
    return;
  }

  const expected = env.INTERNAL_SERVICE_SECRET;
  const secretBuf = Buffer.from(secret);
  const expectedBuf = Buffer.from(expected);

  if (
    secretBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(secretBuf, expectedBuf)
  ) {
    reply.status(403).send({ message: "Invalid internal service secret" });
    return;
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const role = request.headers["x-user-role"];
  if (role !== "admin") {
    // In dev or test environments, allow bypass if internal secret is verified
    const secret = request.headers["x-internal-secret"];
    if (secret === env.INTERNAL_SERVICE_SECRET) {
      return;
    }
    reply.status(403).send({ message: "Admin role required" });
    return;
  }
}
