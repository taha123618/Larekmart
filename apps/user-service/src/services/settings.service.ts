import { settingsRepository } from "../repositories/settings.repository.js";
import {
  getCached,
  setCached,
  invalidateUserCache,
  UserCacheKeys,
} from "../cache/user-cache.js";
import { userMetrics, logger } from "../observability/metrics.js";
import type { UpdateSettingsInput } from "@repo/types";

export class SettingsService {
  async getSettings(userId: string) {
    const cacheKey = UserCacheKeys.settings(userId);
    const cached = await getCached<any>(cacheKey, "settings");
    if (cached) {
      return cached;
    }

    const settings = await settingsRepository.findByUserId(userId);
    if (!settings) {
      return null;
    }

    await setCached(cacheKey, settings, 300);
    return settings;
  }

  async updateSettings(
    userId: string,
    input: UpdateSettingsInput,
    authUserId?: string,
  ) {
    const updated = await settingsRepository.upsert(userId, input);

    userMetrics.usersUpdated.inc();
    await invalidateUserCache(userId, authUserId);

    logger.info(`Settings updated for user: ${userId}`);
    return updated;
  }
}

export const settingsService = new SettingsService();
