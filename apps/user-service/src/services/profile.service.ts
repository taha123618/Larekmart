import { profileRepository } from "../repositories/profile.repository.js";
import { getCached, setCached, invalidateUserCache, UserCacheKeys } from "../cache/user-cache.js";
import { publishUserEvent } from "../publishers/user.publisher.js";
import { userMetrics, logger } from "../observability/metrics.js";
import type { UpdateProfileInput } from "@repo/types";

export class ProfileService {
  async getProfile(userId: string) {
    const cacheKey = UserCacheKeys.userProfile(userId);
    const cached = await getCached<any>(cacheKey, "profile");
    if (cached) {
      return cached;
    }

    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
      return null;
    }

    await setCached(cacheKey, profile, 300);
    return profile;
  }

  async updateProfile(userId: string, input: UpdateProfileInput, authUserId?: string) {
    const updated = await profileRepository.upsert(userId, input);

    userMetrics.usersUpdated.inc();
    await invalidateUserCache(userId, authUserId);

    await publishUserEvent("user.profile_updated", userId, {
      fields: Object.keys(input),
      firstName: updated.firstName,
      lastName: updated.lastName,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
    }, authUserId);

    logger.info(`Profile updated for user: ${userId}`);
    return updated;
  }
}

export const profileService = new ProfileService();
