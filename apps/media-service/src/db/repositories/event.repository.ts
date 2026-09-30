import { eq } from "drizzle-orm";
import { db } from "../client.js";
import type { MediaDb } from "../client.js";
import { processedEvents } from "../schema/index.js";

/**
 * Idempotency ledger for consumed Kafka events. A duplicate delivery is
 * recorded once; subsequent deliveries short-circuit before any side effect.
 */
export const createEventRepository = (database: MediaDb = db) => ({
  /** Returns true when the event was already processed (duplicate delivery). */
  async isProcessed(eventId: string): Promise<boolean> {
    const rows = await database
      .select({ eventId: processedEvents.eventId })
      .from(processedEvents)
      .where(eq(processedEvents.eventId, eventId))
      .limit(1);
    return rows.length > 0;
  },

  /** Records an event as processed. No-op on conflict (consumer races). */
  async markProcessed(eventId: string, eventType: string): Promise<void> {
    await database
      .insert(processedEvents)
      .values({ eventId, eventType })
      .onConflictDoNothing();
  },
});
