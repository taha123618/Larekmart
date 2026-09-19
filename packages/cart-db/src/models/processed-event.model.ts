import mongoose, { InferSchemaType, model, Schema } from "mongoose";

export const ProcessedEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    aggregateId: { type: String, default: null },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Auto-expire processed event records after 30 days to avoid unbounded growth
ProcessedEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export type ProcessedEventDocType = InferSchemaType<
  typeof ProcessedEventSchema
>;

export const ProcessedEvent = model<ProcessedEventDocType>(
  "ProcessedEvent",
  ProcessedEventSchema,
);
