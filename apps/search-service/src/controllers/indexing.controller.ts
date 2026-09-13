import type { FastifyReply, FastifyRequest } from "fastify";
import { reindexService } from "../services/reindex.service.js";
import { ReindexRequestSchema } from "../schemas/indexing.schema.js";

export async function reindexHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = ReindexRequestSchema.parse(request.body || {});
  const result = await reindexService.executeReindex(body);
  const statusCode = result.success ? 200 : 500;
  return reply.status(statusCode).send(result);
}
