import mongoose, {
  InferSchemaType,
  model,
  type ClientSession,
  type Model,
  type HydratedDocument,
} from "mongoose";
const { Schema } = mongoose;

export const OutboxStatus = [
  "PENDING",
  "PROCESSING",
  "PUBLISHED",
  "FAILED",
] as const;
export type OutboxStatusType = (typeof OutboxStatus)[number];

const OutboxEventSchema = new Schema(
  {
    topic: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: OutboxStatus,
      default: "PENDING",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lockedUntil: { type: Date, default: null },
    lockedBy: { type: String, default: null, index: true },
    lastError: { type: String, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// High-performance polling index for claiming pending or expired-lease events:
OutboxEventSchema.index({
  status: 1,
  lockedUntil: 1,
  lockedBy: 1,
  createdAt: 1,
});

// Automated 7-day TTL index for pruning published events:
OutboxEventSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 604800 });

export type OutboxEventSchemaType = InferSchemaType<typeof OutboxEventSchema>;
export type OutboxEventDocument = HydratedDocument<OutboxEventSchemaType>;

export const OutboxEvent: Model<OutboxEventSchemaType> =
  (mongoose.models.OutboxEvent as Model<OutboxEventSchemaType>) ||
  model<OutboxEventSchemaType>("OutboxEvent", OutboxEventSchema);

/**
 * Creates an outbox event document within an optional MongoDB session for atomic transactions.
 */
export async function createOutboxEvent(
  topic: string,
  payload: Record<string, unknown>,
  options?: { session?: ClientSession },
): Promise<OutboxEventDocument> {
  const doc = new OutboxEvent({
    topic,
    payload,
    status: "PENDING",
    attempts: 0,
    maxAttempts: 5,
  });

  if (options?.session) {
    await doc.save({ session: options.session });
  } else {
    await doc.save();
  }

  return doc;
}

/**
 * Atomically claims up to `limit` pending or expired-lease outbox events for processing.
 * Optionally assigns a workerId lease identifier for cluster fencing.
 */
export async function claimPendingOutboxEvents(
  limit = 20,
  leaseDurationMs = 30_000,
  workerId?: string,
): Promise<OutboxEventDocument[]> {
  const now = new Date();
  const leaseExpiry = new Date(Date.now() + leaseDurationMs);

  // Find candidate IDs first
  const candidates = await OutboxEvent.find({
    status: { $in: ["PENDING", "PROCESSING"] },
    $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
    attempts: { $lt: 5 },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("_id")
    .lean();

  if (candidates.length === 0) {
    return [];
  }

  const claimed: OutboxEventDocument[] = [];

  for (const candidate of candidates) {
    const event = await OutboxEvent.findOneAndUpdate(
      {
        _id: candidate._id,
        status: { $in: ["PENDING", "PROCESSING"] },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      {
        $set: {
          status: "PROCESSING",
          lockedUntil: leaseExpiry,
          ...(workerId ? { lockedBy: workerId } : {}),
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );

    if (event) {
      claimed.push(event);
    }
  }

  return claimed;
}

/**
 * Marks an outbox event as successfully published to Kafka.
 * If workerId is provided, enforces fencing: only the lease holder can transition to PUBLISHED.
 */
export async function markOutboxPublished(
  eventId: string | mongoose.Types.ObjectId,
  workerId?: string,
): Promise<boolean> {
  const query: Record<string, unknown> = { _id: eventId };
  if (workerId) {
    query.$or = [{ lockedBy: workerId }, { lockedBy: null }];
  }

  const updated = await OutboxEvent.findOneAndUpdate(query, {
    $set: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      lockedUntil: null,
      lockedBy: null,
      lastError: null,
    },
  });

  return !!updated;
}

/**
 * Records an error and schedules a retry or marks as FAILED if max attempts exceeded.
 */
export async function markOutboxFailed(
  eventId: string | mongoose.Types.ObjectId,
  error: unknown,
  retryDelayMs = 5_000,
  workerId?: string,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const query: Record<string, unknown> = { _id: eventId };
  if (workerId) {
    query.$or = [{ lockedBy: workerId }, { lockedBy: null }];
  }

  const event = await OutboxEvent.findOne(query);
  if (!event) return;

  const isTerminal = event.attempts >= event.maxAttempts;

  await OutboxEvent.findByIdAndUpdate(eventId, {
    $set: {
      status: isTerminal ? "FAILED" : "PENDING",
      lockedUntil: isTerminal ? null : new Date(Date.now() + retryDelayMs),
      lockedBy: null,
      lastError: errorMessage,
    },
  });
}
