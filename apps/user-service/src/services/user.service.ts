import { userRepository } from "../repositories/user.repository.js";
import {
  getCached,
  setCached,
  invalidateUserCache,
  UserCacheKeys,
} from "../cache/user-cache.js";
import { publishUserEvent } from "../publishers/user.publisher.js";
import { userMetrics, logger } from "../observability/metrics.js";
import type { UpdateUserAccountInput } from "@repo/types";
import type { UserStatus } from "@repo/user-db";

export class UserService {
  async getOrCreateUser(authUserId: string, email?: string, phone?: string) {
    let user = await userRepository.findByAuthUserId(authUserId);

    if (!user) {
      if (!email) {
        throw new Error("Email is required to initialize user record");
      }

      logger.info(`Creating initial user record for authUserId: ${authUserId}`);
      user = await userRepository.create({
        authUserId,
        email,
        phone,
      });

      userMetrics.usersCreated.inc();

      await publishUserEvent(
        "user.created",
        user.id,
        {
          email: user.email,
          authUserId: user.authUserId,
        },
        user.authUserId,
      );
    }

    return user;
  }

  async getCurrentUser(authUserId: string) {
    const cacheKey = UserCacheKeys.userByAuth(authUserId);
    const cached = await getCached<any>(cacheKey, "user_me");
    if (cached) {
      return cached;
    }

    const user = await userRepository.findByAuthUserId(authUserId);
    if (!user) {
      return null;
    }

    await setCached(cacheKey, user, 300);
    return user;
  }

  async updateAccount(authUserId: string, input: UpdateUserAccountInput) {
    const user = await userRepository.findByAuthUserId(authUserId);
    if (!user) {
      throw new Error("User not found");
    }

    const updated = await userRepository.update(user.id, {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    });

    userMetrics.usersUpdated.inc();
    await invalidateUserCache(user.id, authUserId);

    await publishUserEvent(
      "user.updated",
      user.id,
      {
        fields: Object.keys(input),
        email: updated.email,
        phone: updated.phone,
      },
      authUserId,
    );

    return updated;
  }

  async requestAccountDeletion(authUserId: string) {
    const user = await userRepository.findByAuthUserId(authUserId);
    if (!user) {
      throw new Error("User not found");
    }

    // Mark as DEACTIVATED to preserve historical integrity while preventing further access
    const updated = await userRepository.updateStatus(user.id, "DEACTIVATED");

    await invalidateUserCache(user.id, authUserId);

    await publishUserEvent(
      "user.deletion_requested",
      user.id,
      {
        requestedAt: new Date().toISOString(),
        email: user.email,
      },
      authUserId,
    );

    logger.info(`User deletion requested for userId: ${user.id}`);
    return {
      success: true,
      message: "Account deletion requested successfully",
      status: updated.status,
    };
  }

  async adminListUsers(params: {
    page?: number;
    limit?: number;
    status?: UserStatus;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const { users, total } = await userRepository.list({
      skip,
      take: limit,
      status: params.status,
      search: params.search,
    });

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminGetUserById(id: string) {
    const user = await userRepository.findById(id);
    if (user) return user;
    return userRepository.findByAuthUserId(id);
  }

  async adminUpdateUserStatus(id: string, status: UserStatus) {
    let user = await userRepository.findById(id);
    if (!user) {
      user = await userRepository.findByAuthUserId(id);
    }
    if (!user) {
      throw new Error("User not found");
    }

    const updated = await userRepository.updateStatus(user.id, status);
    await invalidateUserCache(user.id, user.authUserId);

    await publishUserEvent(
      "user.updated",
      user.id,
      {
        status,
        updatedBy: "admin",
      },
      user.authUserId,
    );

    return updated;
  }
}

export const userService = new UserService();
