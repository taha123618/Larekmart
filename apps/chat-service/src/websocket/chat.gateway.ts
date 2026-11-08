import crypto from "crypto";
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { safeTimingCompare } from "../middleware/auth.middleware.js";
import { PresenceService } from "./presence.service.js";
import { ConversationService } from "../services/conversation.service.js";
import { MessageService } from "../services/message.service.js";

interface JwtClaims {
  sub?: string;
  exp?: number;
  nbf?: number;
  role?: string;
  metadata?: { role?: string; isSeller?: boolean };
}

function verifySocketJwtToken(token: string): JwtClaims | null {
  const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
  const parts = cleanToken.split(".");
  if (parts.length !== 3) return null;

  const jwtKey = env.CLERK_JWT_KEY || process.env.CLERK_JWT_KEY;
  const hmacKey = env.CLERK_JWT_HMAC_KEY || process.env.CLERK_JWT_HMAC_KEY;
  const isTest = env.NODE_ENV === "test";

  const signedData = `${parts[0]}.${parts[1]}`;
  let signature: Buffer;
  try {
    signature = Buffer.from(parts[2]!, "base64url");
  } catch {
    return null;
  }

  let verified = false;
  if (jwtKey && jwtKey.includes("-----BEGIN")) {
    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(signedData);
      verified = verifier.verify(jwtKey, signature);
    } catch {
      verified = false;
    }
  } else if (hmacKey) {
    try {
      const expectedSig = crypto
        .createHmac("sha256", hmacKey)
        .update(signedData)
        .digest();
      verified =
        signature.length === expectedSig.length &&
        crypto.timingSafeEqual(signature, expectedSig);
    } catch {
      verified = false;
    }
  } else if (!isTest) {
    return null;
  }

  if ((jwtKey || hmacKey) && !verified) return null;

  try {
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf-8");
    const claims = JSON.parse(payloadJson) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && now >= claims.exp) return null;
    if (claims.nbf && now < claims.nbf) return null;
    return claims;
  } catch {
    return null;
  }
}

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    path: "/socket.io/chat",
    cors: {
      origin: [
        env.CLIENT_URL,
        env.ADMIN_URL,
        "http://localhost:3000",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
      ],
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
      const isDevOrTest =
        env.NODE_ENV === "development" || env.NODE_ENV === "test";
      const internalSecret = (socket.handshake.headers["x-internal-secret"] ||
        socket.handshake.auth?.internalSecret) as string | undefined;
      const isInternal = safeTimingCompare(
        internalSecret,
        env.INTERNAL_SERVICE_SECRET,
      );

      let userId: string | undefined = undefined;
      let role = "user";

      // 1. Gateway-verified identity (internal secret + gateway header)
      if (isInternal && socket.handshake.headers["x-user-id"]) {
        userId = socket.handshake.headers["x-user-id"] as string;
        role = (socket.handshake.headers["x-user-role"] as string) || "user";
      } else {
        // 2. Cryptographic token verification from handshake auth or Authorization header
        const rawToken =
          (socket.handshake.auth?.token as string | undefined) ||
          (socket.handshake.headers["authorization"] as string | undefined);

        if (rawToken) {
          const verifiedClaims = verifySocketJwtToken(rawToken);
          if (verifiedClaims?.sub) {
            userId = verifiedClaims.sub;
            role =
              verifiedClaims.metadata?.role ||
              verifiedClaims.role ||
              "user";
          }
        }
      }

      // 3. Reject unauthenticated connections in production
      if (env.NODE_ENV === "production" && !userId) {
        return next(
          new Error(
            "Unauthorized: Direct unverified WebSocket connections disallowed in production",
          ),
        );
      }

      // 4. In development/test mode only: fallback
      if (!userId && isDevOrTest) {
        userId = (socket.handshake.auth?.userId ||
          socket.handshake.headers["x-user-id"]) as string | undefined;
        role = (socket.handshake.auth?.role ||
          socket.handshake.headers["x-user-role"] ||
          "user") as string;
      }

      if (!userId) {
        return next(
          new Error("Authentication failed: Missing authenticated credentials"),
        );
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
    socket.join(`user:${userId}`);

    // Scope presence broadcast exclusively to mutual conversation rooms (eliminates O(N^2) cluster fanout)
    let convIds: string[] = [];
    try {
      convIds = await ConversationService.getUserConversationIds(userId);
      for (const convId of convIds) {
        socket.join(`conv:${convId}`);
        socket.to(`conv:${convId}`).emit("presence:updated", {
          userId,
          status: "ONLINE",
          lastSeenAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn(
        `[ChatGateway] Failed to load user conversations for presence scoping: ${err.message}`,
      );
    }

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
      for (const convId of convIds) {
        io?.to(`conv:${convId}`).emit("presence:updated", {
          userId,
          status: "OFFLINE",
          lastSeenAt: new Date().toISOString(),
        });
      }
    });
  });

  return io;
}

export function getSocketIOServer(): SocketIOServer | null {
  return io;
}
