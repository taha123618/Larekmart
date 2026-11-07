import crypto from "node:crypto";
import { Injectable, Logger, Inject } from "@nestjs/common";
import { Server as SocketIoServer, type Socket } from "socket.io";
import { resolveCorsOrigins } from "@repo/types";
import { env } from "../config/env.js";
import { PrismaService } from "../database/prisma.service.js";
import { safeTimingCompare } from "../common/guards/admin.guard.js";

interface JwtClaims {
  sub?: string;
  exp?: number;
  nbf?: number;
  role?: string;
  metadata?: { role?: string; isSeller?: boolean };
}

function verifySupportSocketJwtToken(token: string): JwtClaims | null {
  const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
  const parts = cleanToken.split(".");
  if (parts.length !== 3) return null;

  const jwtKey = process.env.CLERK_JWT_KEY;
  const hmacKey = process.env.CLERK_JWT_HMAC_KEY;
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

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private io: SocketIoServer | null = null;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  initialize(httpServer: any) {
    if (env.NODE_ENV === "test") {
      this.logger.log(
        "Socket.IO running in test mode - server initialization skipped",
      );
      return;
    }

    try {
      const allowedOrigins = resolveCorsOrigins(
        process.env.CORS_ORIGIN || env.ALLOWED_ORIGINS,
      );

      this.io = new SocketIoServer(httpServer, {
        cors: {
          origin: (origin, callback) => {
            if (
              !origin ||
              allowedOrigins.includes(origin) ||
              env.NODE_ENV !== "production"
            ) {
              callback(null, true);
            } else {
              callback(new Error("Not allowed by CORS"), false);
            }
          },
          credentials: true,
        },
        path: "/socket.io",
      });

      // Handshake authentication and zero-trust validation
      this.io.use((socket: Socket, next) => {
        try {
          const auth = socket.handshake.auth || {};
          const headers = socket.handshake.headers || {};
          const isDevOrTest =
            env.NODE_ENV === "development" || env.NODE_ENV === "test";

          const secret = headers["x-internal-secret"] as string | undefined;
          const isInternal = safeTimingCompare(
            secret,
            env.GATEWAY_INTERNAL_SECRET,
          );

          let userId: string | undefined = undefined;
          let role = "user";
          let isSeller = false;

          // 1. Gateway-verified identity (internal secret + gateway header)
          if (isInternal && headers["x-user-id"]) {
            userId = headers["x-user-id"] as string;
            role = (headers["x-user-role"] as string) || "user";
            isSeller = headers["x-user-is-seller"] === "true";
          } else {
            // 2. Cryptographic token verification from handshake auth or Authorization header
            const rawToken =
              (auth.token as string | undefined) ||
              (headers["authorization"] as string | undefined);

            if (rawToken) {
              const verifiedClaims = verifySupportSocketJwtToken(rawToken);
              if (verifiedClaims?.sub) {
                userId = verifiedClaims.sub;
                role =
                  verifiedClaims.metadata?.role ||
                  verifiedClaims.role ||
                  "user";
                isSeller =
                  verifiedClaims.metadata?.isSeller === true ||
                  role === "seller";
              }
            }
          }

          // 3. Reject unauthenticated connections in production
          if (env.NODE_ENV === "production" && !userId) {
            return next(
              new Error("Unauthorized: Invalid internal secret or missing token"),
            );
          }

          // 4. In development/test mode only: fallback
          if (!userId && isDevOrTest) {
            userId =
              (headers["x-user-id"] as string) || (auth.userId as string);
            role =
              (headers["x-user-role"] as string) ||
              (auth.role as string) ||
              "user";
            isSeller =
              headers["x-user-is-seller"] === "true" || auth.isSeller === true;
          }

          if (!userId) {
            return next(
              new Error("Unauthorized: Missing user authentication"),
            );
          }

          socket.data = {
            userId,
            role,
            isSeller,
            isInternal,
            isAdmin: role === "admin" || role === "super_admin",
          };

          next();
        } catch {
          next(new Error("Authentication failed"));
        }
      });

      this.io.on("connection", (socket: Socket) => {
        this.logger.log(
          `Client connected to support realtime: ${socket.id} (user: ${socket.data?.userId})`,
        );

        // Auto-join personal rooms
        if (socket.data?.userId && socket.data.userId !== "system") {
          socket.join(`user:${socket.data.userId}`);
          if (socket.data.isSeller) {
            socket.join(`seller:${socket.data.userId}`);
          }
        }
        if (socket.data?.isAdmin) {
          socket.join("team:staff");
        }

        // Object-level authorization for joining ticket rooms
        socket.on("join:ticket", async (ticketId: string) => {
          if (!ticketId) return;

          if (socket.data?.isAdmin || socket.data?.isInternal) {
            socket.join(`ticket:${ticketId}`);
            socket.join(`ticket:${ticketId}:internal`);
            return;
          }

          try {
            const ticket = await this.prisma.ticket.findFirst({
              where: {
                OR: [{ id: ticketId }, { ticketNumber: ticketId }],
              },
              select: { id: true, customerId: true, sellerId: true },
            });

            if (ticket) {
              const isOwnerCustomer =
                ticket.customerId === socket.data?.userId;
              const isOwnerSeller =
                socket.data?.isSeller &&
                ticket.sellerId === socket.data?.userId;

              if (isOwnerCustomer || isOwnerSeller) {
                socket.join(`ticket:${ticket.id}`);
              } else {
                socket.emit("error", {
                  message: "Access denied to ticket room",
                });
              }
            }
          } catch (err) {
            this.logger.error("Error verifying ticket access for room join", err);
          }
        });

        socket.on("leave:ticket", (ticketId: string) => {
          if (ticketId) {
            socket.leave(`ticket:${ticketId}`);
            socket.leave(`ticket:${ticketId}:internal`);
          }
        });

        // Function-level authorization for agent & team queues
        socket.on("join:agent", (agentId: string) => {
          if (!agentId) return;
          if (socket.data?.isAdmin || socket.data?.userId === agentId) {
            socket.join(`agent:${agentId}`);
          } else {
            socket.emit("error", { message: "Access denied to agent queue" });
          }
        });

        socket.on("join:team", (team: string) => {
          if (!team) return;
          if (socket.data?.isAdmin) {
            socket.join(`team:${team}`);
          } else {
            socket.emit("error", { message: "Access denied to team room" });
          }
        });

        socket.on("disconnect", () => {
          this.logger.log(
            `Client disconnected from support realtime: ${socket.id}`,
          );
        });
      });

      this.logger.log("Socket.IO support gateway initialized successfully");
    } catch (err) {
      this.logger.error("Failed to initialize Socket.IO server", err);
    }
  }

  notifyTicketCreated(ticket: Record<string, any>) {
    if (!this.io) return;
    // Broadcast to staff queue instead of globally to prevent data leakage (SEC-28)
    this.io.to("team:staff").emit("ticket:created", ticket);
    if (ticket.customerId) {
      this.io.to(`user:${ticket.customerId}`).emit("ticket:created", ticket);
    }
    if (ticket.sellerId) {
      this.io.to(`seller:${ticket.sellerId}`).emit("ticket:created", ticket);
    }
  }

  notifyTicketUpdated(ticket: Record<string, any>) {
    if (!this.io) return;
    this.io.to(`ticket:${ticket.id}`).emit("ticket:updated", ticket);
    this.io.to("team:staff").emit("queue:updated", {
      ticketId: ticket.id,
      status: ticket.status,
    });
  }

  notifyTicketAssigned(assignment: Record<string, any>) {
    if (!this.io) return;
    this.io
      .to(`ticket:${assignment.ticketId}`)
      .emit("ticket:assigned", assignment);
    if (assignment.assignedTo) {
      this.io
        .to(`agent:${assignment.assignedTo}`)
        .emit("ticket:assigned_to_me", assignment);
    }
    if (assignment.assignedTeam) {
      this.io
        .to(`team:${assignment.assignedTeam}`)
        .emit("team:new_assignment", assignment);
    }
  }

  notifyTicketMessage(ticketId: string, message: Record<string, any>) {
    if (!this.io) return;
    // Internal notes are only broadcast to staff/agents
    if (message.isInternalNote) {
      this.io
        .to(`ticket:${ticketId}:internal`)
        .emit("ticket:internal_note", message);
    } else {
      this.io.to(`ticket:${ticketId}`).emit("ticket:message", message);
    }
  }

  notifyTicketResolved(ticket: Record<string, any>) {
    if (!this.io) return;
    this.io.to(`ticket:${ticket.id}`).emit("ticket:resolved", ticket);
  }
}
