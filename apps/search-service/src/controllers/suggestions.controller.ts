import type { FastifyReply, FastifyRequest } from "fastify";
import { suggestionService } from "../services/suggestion.service.js";
import { SuggestionQuerySchema } from "../schemas/suggestion.schema.js";

export async function getSuggestionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const queryParams = SuggestionQuerySchema.parse(request.query);
  const response = await suggestionService.getSuggestions(queryParams);
  return reply.status(200).send(response);
}
