import { FastifyInstance } from "fastify";
import {
  SendMessageSchema,
  MessageFilterSchema,
  MarkReadSchema,
  ReportMessageSchema,
  BlockUserSchema,
} from "@repo/types";
import { requireAuth } from "../middleware/auth.middleware.js";
import { idempotencyHook } from "../middleware/idempotency.middleware.js";
import { MessageService } from "../services/message.service.js";
import { getSocketIOServer } from "../websocket/chat.gateway.js";

export async function registerMessageRoutes(
  app: FastifyInstance,
): Promise<void> {
  // 1. Get messages in conversation (paginated)
  app.get(
    "/api/v1/chat/conversations/:id/messages",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = MessageFilterSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid query parameters",
          issues: parsed.error.issues,
        });
      }

      const user = request.user!;
      try {
        const result = await MessageService.listMessages(
          id,
          user.userId,
          parsed.data,
          user.isAdmin,
        );
        return reply.send(result);
      } catch (err: any) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: err.message,
        });
      }
    },
  );

  // 2. Send message into conversation
  app.post(
    "/api/v1/chat/conversations/:id/messages",
    { preHandler: [requireAuth, idempotencyHook] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bodyWithConv = {
        ...(typeof request.body === "object" && request.body !== null
          ? request.body
          : {}),
        conversationId: id,
      };

      const parsed = SendMessageSchema.safeParse(bodyWithConv);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Validation failed",
          issues: parsed.error.issues,
        });
      }

      const user = request.user!;
      try {
        const message = await MessageService.sendMessage(
          user.userId,
          user.role,
          parsed.data,
        );

        // Broadcast to Socket.IO room if gateway is active
        const io = getSocketIOServer();
        if (io) {
          io.to(`conv:${id}`).emit("message:created", message);
        }

        return reply.status(201).send(message);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: err.message,
        });
      }
    },
  );

  // 3. Mark conversation read
  app.post(
    "/api/v1/chat/conversations/:id/messages/read",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = MarkReadSchema.safeParse({
        ...(typeof request.body === "object" && request.body !== null
          ? request.body
          : {}),
        conversationId: id,
      });

      const user = request.user!;
      try {
        const result = await MessageService.markAsRead(
          id,
          user.userId,
          parsed.success ? parsed.data.messageId : undefined,
        );
        return reply.send(result);
      } catch (err: any) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: err.message,
        });
      }
    },
  );

  // 4. Report abusive message
  app.post(
    "/api/v1/chat/messages/:messageId/report",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { messageId } = request.params as { messageId: string };
      const parsed = ReportMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid report payload",
          issues: parsed.error.issues,
        });
      }

      const user = request.user!;
      try {
        const result = await MessageService.reportMessage(
          messageId,
          user.userId,
          parsed.data,
        );
        return reply.status(201).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: err.message,
        });
      }
    },
  );

  // 5. Block user
  app.post(
    "/api/v1/chat/users/:userId/block",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { userId: targetUserId } = request.params as { userId: string };
      const parsed = BlockUserSchema.safeParse({
        ...(typeof request.body === "object" && request.body !== null
          ? request.body
          : {}),
        blockedUserId: targetUserId,
      });

      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid block payload",
          issues: parsed.error.issues,
        });
      }

      const user = request.user!;
      try {
        const result = await MessageService.blockUser(user.userId, parsed.data);
        return reply.status(201).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: err.message,
        });
      }
    },
  );

  // 6. Unblock user
  const handleUnblock = async (request: any, reply: any) => {
    const { userId: targetUserId } = request.params as { userId: string };
    const user = request.user!;
    try {
      const result = await MessageService.unblockUser(user.userId, targetUserId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: err.message,
      });
    }
  };

  app.delete("/api/v1/chat/users/:userId/block", { preHandler: [requireAuth] }, handleUnblock);
  app.post("/api/v1/chat/users/:userId/unblock", { preHandler: [requireAuth] }, handleUnblock);
}
