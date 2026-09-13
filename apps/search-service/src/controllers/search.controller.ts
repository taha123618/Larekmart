import type { FastifyReply, FastifyRequest } from "fastify";
import { searchService } from "../services/search.service.js";
import { SearchQueryParamsSchema } from "../schemas/search.schema.js";

export async function searchProductsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const queryParams = SearchQueryParamsSchema.parse(request.query);
  const response = await searchService.executeSearch(queryParams);
  return reply.status(200).send(response);
}
