import { db } from "./connection.js";
import { outboxEvents } from "./schema.js";
import { v4 as uuidv4 } from "uuid";

export interface CreatePayoutOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Creates a transactional outbox event inside an optional Drizzle transaction/client.
 * Captured by Debezium Server CDC and routed directly to the Kafka topic named in `type`
 * with `aggregateId` as the partition key.
 */
export async function createPayoutOutboxEvent(
  input: CreatePayoutOutboxEventInput,
  tx?: any,
): Promise<void> {
  const client = tx || db;
  const now = input.timestamp || new Date();

  await client.insert(outboxEvents).values({
    id: `ob_${uuidv4()}`,
    aggregatetype: input.aggregateType,
    aggregateid: input.aggregateId,
    type: input.type,
    payload: input.payload,
    timestamp: now,
    createdAt: now,
  });
}
