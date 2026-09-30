import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Idempotency ledger for consumed Kafka events. */
export const processedEvents = pgTable("processed_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProcessedEventSelect = typeof processedEvents.$inferSelect;
export type ProcessedEventInsert = typeof processedEvents.$inferInsert;
