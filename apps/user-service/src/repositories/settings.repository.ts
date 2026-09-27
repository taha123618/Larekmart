import { prisma } from "@repo/user-db";
import type { UpdateSettingsInput } from "@repo/types";
import type { Prisma } from "@repo/user-db";

export class SettingsRepository {
  async findByUserId(userId: string) {
    return prisma.userSettings.findUnique({
      where: { userId },
    });
  }

  async upsert(userId: string, data: UpdateSettingsInput) {
    const updateData: Prisma.UserSettingsUpdateInput = {};

    if (data.twoFactorPrompt !== undefined) updateData.twoFactorPrompt = data.twoFactorPrompt;
    if (data.profileVisibility !== undefined) {
      updateData.profileVisibility = data.profileVisibility;
    }
    if (data.orderUpdatesEmail !== undefined) {
      updateData.orderUpdatesEmail = data.orderUpdatesEmail;
    }
    if (data.orderUpdatesSms !== undefined) updateData.orderUpdatesSms = data.orderUpdatesSms;
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata as Prisma.InputJsonValue;
    }

    return prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        twoFactorPrompt: data.twoFactorPrompt ?? false,
        profileVisibility: data.profileVisibility || "private",
        orderUpdatesEmail: data.orderUpdatesEmail ?? true,
        orderUpdatesSms: data.orderUpdatesSms ?? false,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
      update: updateData,
    });
  }
}

export const settingsRepository = new SettingsRepository();
