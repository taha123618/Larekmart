import type { FastifyReply, FastifyRequest } from "fastify";
import { settingsService } from "../services/settings.service.js";
import { userService } from "../services/user.service.js";
import { UpdateSettingsSchema } from "@repo/types";

export class SettingsController {
  async getMySettings(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const settings = await settingsService.getSettings(user.id);
    return reply.status(200).send(settings || {});
  }

  async updateMySettings(request: FastifyRequest, reply: FastifyReply) {
    const authUserId = request.authUserId!;
    const user = await userService.getCurrentUser(authUserId);

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const body = UpdateSettingsSchema.parse(request.body);
    const updated = await settingsService.updateSettings(
      user.id,
      body,
      authUserId,
    );

    return reply.status(200).send(updated);
  }
}

export const settingsController = new SettingsController();
