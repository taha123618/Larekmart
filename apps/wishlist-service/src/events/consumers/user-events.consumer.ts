import { wishlistRepository } from "../../repositories/wishlist.repository.js";
import { logger } from "../../observability/metrics.js";

interface UserDeletedPayload {
  userId?: string;
  data?: { userId?: string };
}

export async function handleUserDeleted(rawPayload: unknown): Promise<void> {
  try {
    const payload = rawPayload as UserDeletedPayload;
    const userId = payload.userId || payload.data?.userId;

    if (!userId) return;

    logger.info(
      `[UserDeleted] Cleaning up wishlists for deleted user ${userId}`,
    );
    const deletedCount = await wishlistRepository.deleteByUserId(userId);
    logger.info(
      `[UserDeleted] Deleted ${deletedCount} wishlists for user ${userId}`,
    );
  } catch (error) {
    logger.error("Error processing user.deleted event in wishlist-service:", {
      error,
    });
  }
}
