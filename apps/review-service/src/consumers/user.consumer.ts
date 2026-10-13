import { reviewRepository } from "../repositories/review.repository.js";

export async function handleUserDeleted(payload: any): Promise<void> {
  try {
    const data = payload?.data || payload;
    const userId = data?.userId || data?.id;

    if (!userId) {
      console.warn("[UserConsumer] Missing userId in user.deleted event");
      return;
    }

    console.log(
      `[UserConsumer] Anonymizing reviews for deleted user ${userId}`,
    );
    await reviewRepository.anonymizeUserReviews(String(userId));
  } catch (error) {
    console.error("[UserConsumer] Error handling user.deleted event:", error);
  }
}
