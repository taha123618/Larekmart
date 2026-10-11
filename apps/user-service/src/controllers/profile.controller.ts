import type { FastifyReply, FastifyRequest } from "fastify";
import { profileService } from "../services/profile.service.js";
import { userService } from "../services/user.service.js";
import { UpdateProfileSchema } from "@repo/types";

export class ProfileController {
  async getMyProfile(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    let user = await userService.getCurrentUser(authUserId);

    if (!user) {
      user = await userService.getOrCreateUser(authUserId);
    }

    const profile = await profileService.getProfile(user.id);
    return reply.status(200).send(profile || {});
  }

  async updateMyProfile(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    let user = await userService.getCurrentUser(authUserId);

    if (!user) {
      user = await userService.getOrCreateUser(authUserId);
    }

    const body = UpdateProfileSchema.parse(request.body);
    const updated = await profileService.updateProfile(
      user.id,
      body,
      authUserId,
    );

    return reply.status(200).send(updated);
  }
}

export const profileController = new ProfileController();
