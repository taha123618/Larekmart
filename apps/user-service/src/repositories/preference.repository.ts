import { prisma } from "@repo/user-db";
import type { UpdatePreferencesInput } from "@repo/types";
import type { Prisma } from "@repo/user-db";

export class PreferenceRepository {
  async findByUserId(userId: string) {
    return prisma.userPreferences.findUnique({
      where: { userId },
    });
  }

  async upsert(userId: string, data: UpdatePreferencesInput) {
    const updateData: Prisma.UserPreferencesUpdateInput = {};

    if (data.preferredLanguage !== undefined)
      updateData.preferredLanguage = data.preferredLanguage;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.marketingEmail !== undefined)
      updateData.marketingEmail = data.marketingEmail;
    if (data.marketingSms !== undefined)
      updateData.marketingSms = data.marketingSms;
    if (data.pushNotifications !== undefined)
      updateData.pushNotifications = data.pushNotifications;
    if (data.productRecommendations !== undefined) {
      updateData.productRecommendations = data.productRecommendations;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata as Prisma.InputJsonValue;
    }

    return prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        preferredLanguage: data.preferredLanguage || "en",
        currency: data.currency || "USD",
        timezone: data.timezone || "UTC",
        marketingEmail: data.marketingEmail ?? true,
        marketingSms: data.marketingSms ?? false,
        pushNotifications: data.pushNotifications ?? true,
        productRecommendations: data.productRecommendations ?? true,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
      update: updateData,
    });
  }
}

export const preferenceRepository = new PreferenceRepository();
