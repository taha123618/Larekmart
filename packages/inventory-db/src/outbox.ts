import { prisma } from "./client.js";
import type { Prisma } from "../generated/prisma/index.js";

export interface CreateOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Creates a transactional outbox event inside an optional Prisma transaction client.
 * Captured by Debezium Server CDC and routed directly to the Kafka topic named in `type`
 * with `aggregateId` as the partition key.
 */
export async function createInventoryOutboxEvent(
  input: CreateOutboxEventInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx || prisma;
  const now = input.timestamp || new Date();

  await client.outboxEvent.create({
    data: {
      aggregatetype: input.aggregateType,
      aggregateid: input.aggregateId,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      timestamp: now,
      createdAt: now,
    },
  });
}
