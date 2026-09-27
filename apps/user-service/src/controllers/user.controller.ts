import type { FastifyReply, FastifyRequest } from "fastify";
import { userService } from "../services/user.service.js";
import {
  UpdateUserAccountSchema,
  AdminUpdateUserStatusSchema,
} from "@repo/types";
import type { UserStatus } from "@repo/user-db";

export class UserController {
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    let user = await userService.getCurrentUser(authUserId);

    if (!user) {
      // Auto-provision if initial request carries email or Clerk metadata
      const query = request.query as { email?: string; phone?: string };
      if (query.email) {
        user = await userService.getOrCreateUser(authUserId, query.email, query.phone);
      } else {
        return reply.status(404).send({ message: "User account not found. Please sync via auth webhook or provide email." });
      }
    }

    return reply.status(200).send(user);
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const body = UpdateUserAccountSchema.parse(request.body);

    const updated = await userService.updateAccount(authUserId, body);
    return reply.status(200).send(updated);
  }

  async deleteMe(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const result = await userService.requestAccountDeletion(authUserId);
    return reply.status(200).send(result);
  }

  async adminListUsers(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      page?: string;
      limit?: string;
      status?: string;
      search?: string;
    };

    const page = query.page ? Number.parseInt(query.page, 10) : 1;
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;

    const result = await userService.adminListUsers({
      page,
      limit,
      status: query.status as UserStatus | undefined,
      search: query.search,
    });

    return reply.status(200).send(result);
  }

  async adminGetUser(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const user = await userService.adminGetUserById(params.id);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    return reply.status(200).send(user);
  }

  async adminUpdateStatus(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const body = AdminUpdateUserStatusSchema.parse(request.body);

    const updated = await userService.adminUpdateUserStatus(params.id, body.status);
    return reply.status(200).send(updated);
  }
}

export const userController = new UserController();
