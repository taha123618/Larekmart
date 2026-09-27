import { preferenceRepository } from "../repositories/preference.repository.js";
import {
  getCached,
  setCached,
  invalidateUserCache,
  UserCacheKeys,
} from "../cache/user-cache.js";
import { publishUserEvent } from "../publishers/user.publisher.js";
import { userMetrics, logger } from "../observability/metrics.js";
import type { UpdatePreferencesInput } from "@repo/types";

export class PreferenceService {
  async getPreferences(userId: string) {
    const cacheKey = UserCacheKeys.preferences(userId);
    const cached = await getCached<any>(cacheKey, "preferences");
    if (cached) {
      return cached;
    }

    const preferences = await preferenceRepository.findByUserId(userId);
    if (!preferences) {
      return null;
    }

    await setCached(cacheKey, preferences, 300);
    return preferences;
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
    authUserId?: string,
  ) {
    const updated = await preferenceRepository.upsert(userId, input);

    userMetrics.usersUpdated.inc();
    await invalidateUserCache(userId, authUserId);

    await publishUserEvent(
      "user.preferences_updated",
      userId,
      {
        fields: Object.keys(input),
        preferredLanguage: updated.preferredLanguage,
        currency: updated.currency,
        timezone: updated.timezone,
        marketingEmail: updated.marketingEmail,
        marketingSms: updated.marketingSms,
        pushNotifications: updated.pushNotifications,
        productRecommendations: updated.productRecommendations,
      },
      authUserId,
    );

    logger.info(`Preferences updated for user: ${userId}`);
    return updated;
  }
}

export const preferenceService = new PreferenceService();
