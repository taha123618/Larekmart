import type { FastifyReply, FastifyRequest } from "fastify";
import { preferenceService } from "../services/preference.service.js";
import { userService } from "../services/user.service.js";
import { UpdatePreferencesSchema } from "@repo/types";

export class PreferenceController {
  async getMyPreferences(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const preferences = await preferenceService.getPreferences(user.id);
    return reply.status(200).send(preferences || {});
  }

  async updateMyPreferences(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const body = UpdatePreferencesSchema.parse(request.body);
    const updated = await preferenceService.updatePreferences(
      user.id,
      body,
      authUserId,
    );

    return reply.status(200).send(updated);
  }
}

export const preferenceController = new PreferenceController();
