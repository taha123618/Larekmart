import { userRepository } from "../repositories/user.repository.js";
import { profileRepository } from "../repositories/profile.repository.js";
import { idempotencyRepository } from "../repositories/idempotency.repository.js";
import { logger, userMetrics } from "../observability/metrics.js";

export async function handleAuthUserCreated(payload: any): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;

    const eventId = target.eventId || target.id || `evt_${Date.now()}`;
    const eventType = target.eventType || "user.created";

    // Idempotency check
    const alreadyProcessed =
      await idempotencyRepository.isEventProcessed(eventId);
    if (alreadyProcessed) {
      logger.info(`Kafka event ${eventId} already processed, skipping`);
      return;
    }

    // Support both direct Clerk webhook payload format and standard Larekmart event envelope
    const data = target.data || target;
    const authUserId = target.userId || data.id || target.authUserId;
    const email =
      data.email || data.email_addresses?.[0]?.email_address || target.email;
    const phone =
      data.phone ||
      data.phone_numbers?.[0]?.phone_number ||
      target.phone ||
      null;
    const firstName = data.firstName || data.first_name || null;
    const lastName = data.lastName || data.last_name || null;
    const isSeller = Boolean(
      data.isSeller ||
        data.public_metadata?.isSeller ||
        data.publicMetadata?.isSeller ||
        data.public_metadata?.role === "seller" ||
        data.publicMetadata?.role === "seller",
    );

    if (!authUserId || !email) {
      logger.warn("Received user creation event without authUserId or email", {
        target,
      });
      return;
    }

    // Check if user already exists
    let user = await userRepository.findByAuthUserId(authUserId);
    if (!user) {
      user = await userRepository.create({
        authUserId,
        email,
        phone,
        firstName,
        lastName,
        isSeller,
      });
      logger.info(
        `Created user-service account for authUserId: ${authUserId}, userId: ${user.id}`,
      );
    } else {
      // Sync profile fields if missing
      await profileRepository.upsert(user.id, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        displayName:
          firstName && lastName
            ? `${firstName} ${lastName}`
            : firstName || undefined,
      });

      if (isSeller && !user.isSeller) {
        await userRepository.updateStatus(user.id, { isSeller: true });
        logger.info(
          `Granted isSeller=true in database to user ${user.id} (authUserId: ${authUserId}) on event sync`,
        );
      }

      logger.info(
        `Updated user profile for existing authUserId: ${authUserId}`,
      );
    }

    // Mark event as processed
    await idempotencyRepository.markEventProcessed(eventId, eventType);
    userMetrics.kafkaEventsConsumed.inc({ topic: eventType });
  } catch (error) {
    userMetrics.kafkaEventsFailed.inc({ topic: "user.created" });
    logger.error("Error handling user creation Kafka event in user-service", {
      error: String(error),
    });
  }
}

export async function handleSellerPrivilegeGranted(
  payload: any,
): Promise<void> {
  try {
    if (!payload) return;
    const target = payload.value !== undefined ? payload.value : payload;
    const authUserId =
      target.primaryUserId || target.ownerUserId || target.userId;
    if (!authUserId) return;

    const user = await userRepository.findByAuthUserId(authUserId);
    if (user && !user.isSeller) {
      await userRepository.updateStatus(user.id, { isSeller: true });
      logger.info(
        `Granted isSeller=true in database to user ${user.id} (authUserId: ${authUserId}) from seller/vendor event`,
      );
    }
  } catch (error) {
    logger.error("Error updating seller privilege from event in user-service", {
      error: String(error),
    });
  }
}
