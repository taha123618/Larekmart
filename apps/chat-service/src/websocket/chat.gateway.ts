import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { safeTimingCompare } from "../middleware/auth.middleware.js";
import { PresenceService } from "./presence.service.js";
import { ConversationService } from "../services/conversation.service.js";
import { MessageService } from "../services/message.service.js";

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    path: "/socket.io/chat",
    cors: {
      origin: [env.CLIENT_URL, env.ADMIN_URL, "http://localhost:3000", "http://localhost:3002", "http://localhost:3003"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Setup Redis adapter for cross-instance horizontal scaling
  try {
    const pubClient = new Redis(env.REDIS_URL, { lazyConnect: true });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io?.adapter(createAdapter(pubClient, subClient));
        console.log("[ChatGateway:Socket.IO] Redis adapter initialized successfully.");
      })
      .catch((err) => {
        console.warn("[ChatGateway:Socket.IO] Redis adapter connection warning:", err.message);
      });
  } catch (err) {
    console.warn("[ChatGateway:Socket.IO] Failed to configure Redis adapter:", err);
  }

  // Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const isDevOrTest = env.NODE_ENV === "development" || env.NODE_ENV === "test";
      const internalSecret = (socket.handshake.headers["x-internal-secret"] || socket.handshake.auth?.internalSecret) as string | undefined;
      const isInternal = safeTimingCompare(internalSecret, env.INTERNAL_SERVICE_SECRET);

      const userId = (socket.handshake.auth?.userId || socket.handshake.headers["x-user-id"]) as string | undefined;
      const role = (socket.handshake.auth?.role || socket.handshake.headers["x-user-role"] || "user") as string;

      // In production, reject unverified connections lacking valid internal secret or credentials
      if (!isInternal && !isDevOrTest) {
        return next(new Error("Unauthorized: Direct unverified WebSocket connections disallowed in production"));
      }

      if (!userId) {
        return next(new Error("Authentication failed: Missing userId in handshake"));
      }

      socket.data.userId = userId;
      socket.data.role = role;
      next();
    } catch (err) {
      next(new Error("Unauthorized connection"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as string;

    // Track presence
    await PresenceService.setUserOnline(userId);
    io?.emit("presence:updated", {
      userId,
      status: "ONLINE",
      lastSeenAt: new Date().toISOString(),
    });

    // 1. Join Conversation Room
    socket.on("conversation:join", async (data: { conversationId: string }, callback) => {
      try {
        const isParticipant = await ConversationService.isParticipant(data.conversationId, userId);
        if (!isParticipant && role !== "admin") {
          return callback?.({ error: "Forbidden: Not a participant" });
        }

        socket.join(`conv:${data.conversationId}`);
        callback?.({ success: true, room: `conv:${data.conversationId}` });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    // 2. Leave Conversation Room
    socket.on("conversation:leave", (data: { conversationId: string }, callback) => {
      socket.leave(`conv:${data.conversationId}`);
      callback?.({ success: true });
    });

    // 3. Send Message Real-Time
    socket.on("message:send", async (data: {
      conversationId: string;
      content: string;
      messageType?: any;
      replyToMessageId?: string;
      attachments?: any[];
    }, callback) => {
      try {
        const created = await MessageService.sendMessage(userId, role, {
          conversationId: data.conversationId,
          content: data.content,
          messageType: data.messageType || "TEXT",
          replyToMessageId: data.replyToMessageId,
          attachments: data.attachments,
        });

        // Broadcast to conversation room
        io?.to(`conv:${data.conversationId}`).emit("message:created", created);
        callback?.({ success: true, message: created });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    // 4. Typing Indicators
    socket.on("typing:start", (data: { conversationId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("typing:start", {
        conversationId: data.conversationId,
        userId,
      });
    });

    socket.on("typing:stop", (data: { conversationId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("typing:stop", {
        conversationId: data.conversationId,
        userId,
      });
    });

    // 5. Message Read Acknowledgment
    socket.on("message:read", async (data: { conversationId: string; messageId?: string }) => {
      try {
        await MessageService.markAsRead(data.conversationId, userId, data.messageId);
        socket.to(`conv:${data.conversationId}`).emit("message:read", {
          conversationId: data.conversationId,
          userId,
          messageId: data.messageId,
          readAt: new Date().toISOString(),
        });
      } catch {}
    });

    // Disconnect
    socket.on("disconnect", async () => {
      await PresenceService.setUserOffline(userId);
      io?.emit("presence:updated", {
        userId,
        status: "OFFLINE",
        lastSeenAt: new Date().toISOString(),
      });
    });
  });

  return io;
}

export function getSocketIOServer(): SocketIOServer | null {
  return io;
}
