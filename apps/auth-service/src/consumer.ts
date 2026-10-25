import { createKafkaClient, createConsumer } from "@repo/kafka";
import { SELLER_TOPICS } from "@repo/types";
import { createLogger, captureError } from "@repo/monitoring";
import clerkClient from "./utils/clerk.js";

const logger = createLogger("auth-service:consumer");

export interface SellerActivatedPayload {
  sellerId: string;
  vendorId?: string;
  userId?: string;
  primaryUserId?: string;
  isSeller?: boolean;
}

export interface SellerSuspendedPayload {
  sellerId: string;
  vendorId?: string;
  userId?: string;
  primaryUserId?: string;
  isSeller?: boolean;
  reason?: string;
}

export interface AdminDelegationPayload {
  delegationId?: string;
  adminUserId: string;
  permission?: string;
  action?: "GRANTED" | "REVOKED";
}

/**
 * Updates Clerk user publicMetadata to reflect verified seller status (isSeller: true).
 */
export async function handleSellerActivatedEvent(
  payload: SellerActivatedPayload,
  client = clerkClient,
): Promise<boolean> {
  const targetUserId = payload.userId || payload.primaryUserId;
  if (!targetUserId) {
    logger.warn(
      `[Kafka:seller.activated] Missing target userId for sellerId=${payload.sellerId}`,
    );
    return false;
  }

  try {
    logger.info(
      `[Kafka:seller.activated] Synchronizing isSeller=true in Clerk for userId=${targetUserId}`,
    );
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        isSeller: true,
      },
    });
    return true;
  } catch (error) {
    logger.error(
      `[Kafka:seller.activated] Failed to update Clerk metadata for userId=${targetUserId}:`,
      error,
    );
    captureError(error, {
      serviceName: "auth-service",
      logger,
      context: "handleSellerActivatedEvent",
    });
    return false;
  }
}

/**
 * Updates Clerk user publicMetadata to disable seller status (isSeller: false).
 */
export async function handleSellerSuspendedEvent(
  payload: SellerSuspendedPayload,
  client = clerkClient,
): Promise<boolean> {
  const targetUserId = payload.userId || payload.primaryUserId;
  if (!targetUserId) {
    logger.warn(
      `[Kafka:seller.suspended] Missing target userId for sellerId=${payload.sellerId}`,
    );
    return false;
  }

  try {
    logger.info(
      `[Kafka:seller.suspended] Synchronizing isSeller=false in Clerk for userId=${targetUserId} (Reason: ${payload.reason ?? "N/A"})`,
    );
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        isSeller: false,
      },
    });
    return true;
  } catch (error) {
    logger.error(
      `[Kafka:seller.suspended] Failed to reset Clerk isSeller for userId=${targetUserId}:`,
      error,
    );
    captureError(error, {
      serviceName: "auth-service",
      logger,
      context: "handleSellerSuspendedEvent",
    });
    return false;
  }
}

/**
 * Grants delegated Manage Admin verification authority in Clerk publicMetadata (canManageSellers: true).
 */
export async function handleDelegationGrantedEvent(
  payload: AdminDelegationPayload,
  client = clerkClient,
): Promise<boolean> {
  const { adminUserId } = payload;
  if (!adminUserId) {
    logger.warn(
      "[Kafka:admin.delegation.granted] Missing target adminUserId in payload",
    );
    return false;
  }

  try {
    logger.info(
      `[Kafka:admin.delegation.granted] Synchronizing canManageSellers=true in Clerk for adminUserId=${adminUserId}`,
    );
    await client.users.updateUserMetadata(adminUserId, {
      publicMetadata: {
        canManageSellers: true,
      },
    });
    return true;
  } catch (error) {
    logger.error(
      `[Kafka:admin.delegation.granted] Failed to grant canManageSellers in Clerk for adminUserId=${adminUserId}:`,
      error,
    );
    captureError(error, {
      serviceName: "auth-service",
      logger,
      context: "handleDelegationGrantedEvent",
    });
    return false;
  }
}

/**
 * Revokes delegated Manage Admin verification authority in Clerk publicMetadata (canManageSellers: false).
 */
export async function handleDelegationRevokedEvent(
  payload: AdminDelegationPayload,
  client = clerkClient,
): Promise<boolean> {
  const { adminUserId } = payload;
  if (!adminUserId) {
    logger.warn(
      "[Kafka:admin.delegation.revoked] Missing target adminUserId in payload",
    );
    return false;
  }

  try {
    logger.info(
      `[Kafka:admin.delegation.revoked] Revoking canManageSellers in Clerk for adminUserId=${adminUserId}`,
    );
    await client.users.updateUserMetadata(adminUserId, {
      publicMetadata: {
        canManageSellers: false,
      },
    });
    return true;
  } catch (error) {
    logger.error(
      `[Kafka:admin.delegation.revoked] Failed to revoke canManageSellers in Clerk for adminUserId=${adminUserId}:`,
      error,
    );
    captureError(error, {
      serviceName: "auth-service",
      logger,
      context: "handleDelegationRevokedEvent",
    });
    return false;
  }
}

/**
 * Initializes and starts Kafka consumer subscriptions for auth-service.
 */
export async function startAuthConsumer(): Promise<void> {
  const kafkaBrokers = (
    process.env.KAFKA_BROKERS || "localhost:9094,localhost:9095,localhost:9096"
  )
    .split(",")
    .map((b) => b.trim());

  const kafka = createKafkaClient("auth-service-consumer", kafkaBrokers);
  const consumer = createConsumer(kafka, "auth-service-metadata-group");

  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: SELLER_TOPICS.ACTIVATED,
        topicHandler: async (message) => {
          await handleSellerActivatedEvent(message);
        },
      },
      {
        topicName: SELLER_TOPICS.SUSPENDED,
        topicHandler: async (message) => {
          await handleSellerSuspendedEvent(message);
        },
      },
      {
        topicName: SELLER_TOPICS.DELEGATION_GRANTED,
        topicHandler: async (message) => {
          await handleDelegationGrantedEvent(message);
        },
      },
      {
        topicName: SELLER_TOPICS.DELEGATION_REVOKED,
        topicHandler: async (message) => {
          await handleDelegationRevokedEvent(message);
        },
      },
    ]);
    logger.info(
      "Auth-service Kafka metadata consumer started and subscribed to seller/delegation topics.",
    );
  } catch (error) {
    logger.warn(
      "Auth-service Kafka consumer could not connect (broker may be unavailable in local dev); continuing HTTP listener.",
      { error: String(error) },
    );
  }
}
