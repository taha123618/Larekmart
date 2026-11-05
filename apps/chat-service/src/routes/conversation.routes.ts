import { FastifyInstance } from "fastify";
import {
  CreateConversationSchema,
  ConversationFilterSchema,
} from "@repo/types";
import { requireAuth } from "../middleware/auth.middleware.js";
import { idempotencyHook } from "../middleware/idempotency.middleware.js";
import { ConversationService } from "../services/conversation.service.js";

export async function registerConversationRoutes(
  app: FastifyInstance,
): Promise<void> {
  // 1. Create a new conversation
  app.post(
    "/api/v1/chat/conversations",
    { preHandler: [requireAuth, idempotencyHook] },
    async (request, reply) => {
      const parsed = CreateConversationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Validation failed",
          issues: parsed.error.issues,
        });
      }

      try {
        const user = request.user!;
        const conversation = await ConversationService.createConversation(
          user.userId,
          user.role,
          parsed.data,
        );
        return reply.status(201).send(conversation);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: err.message,
        });
      }
    },
  );

  // 2. List user conversations
  app.get(
    "/api/v1/chat/conversations",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = ConversationFilterSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid query parameters",
          issues: parsed.error.issues,
        });
      }

      const user = request.user!;
      const result = await ConversationService.listUserConversations(
        user.userId,
        parsed.data,
        user.isAdmin,
      );
      return reply.send(result);
    },
  );

  // 3. Get single conversation details
  app.get(
    "/api/v1/chat/conversations/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      try {
        const conv = await ConversationService.getConversationById(
          id,
          user.userId,
          user.isAdmin,
        );
        if (!conv) {
          return reply.status(404).send({
            statusCode: 404,
            error: "Not Found",
            message: "Conversation not found",
          });
        }
        return reply.send(conv);
      } catch (err: any) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: err.message,
        });
      }
    },
  );
}
