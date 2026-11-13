/**
 * @file types.ts
 * @description Contract definitions for Kafka Dead-Letter Queue (DLQ) inspection,
 * auditing, payload mutation, and guarded replay across Larekmart.
 */

export interface DeadLetterHeaders {
  "x-original-topic"?: string;
  "x-original-partition"?: string;
  "x-original-offset"?: string;
  "x-consumer-group"?: string;
  "x-error-message"?: string;
  "x-error-name"?: string;
  "x-error-stack"?: string;
  "x-attempt-count"?: string;
  "x-is-poison-pill"?: string;
  "x-failed-at"?: string;
  "x-larekmart-replay-count"?: string;
  "x-larekmart-replayed-by"?: string;
  "x-larekmart-replayed-at"?: string;
  "x-larekmart-payload-modified"?: string;
  [key: string]: string | undefined;
}

export type DeadLetterStatus = "PENDING" | "REPLAYED" | "PARKED_TERMINAL";

export interface DeadLetterRecord {
  id: string; // ${dlqTopic}-${partition}-${offset}
  originalTopic: string;
  dlqTopic: string;
  partition: number;
  offset: string;
  key: string | null;
  rawPayload: string;
  parsedPayload?: Record<string, unknown> | null;
  errorMessage: string;
  errorName: string;
  errorStack: string;
  attemptCount: number;
  isPoisonPill: boolean;
  consumerGroup: string;
  failedAt: string;
  replayCount: number;
  status: DeadLetterStatus;
  replayedAt?: string;
  replayedBy?: string;
  payloadModified?: boolean;
}

export interface DlqTopicSummary {
  topic: string;
  originalTopic: string;
  partitions: number;
  totalMessages: number;
  oldestOffset: string;
  latestOffset: string;
}

export interface ReplayOptions {
  recordId: string;
  dlqTopic: string;
  partition: number;
  offset: string;
  targetTopic?: string;
  modifiedPayload?: string;
  replayedBy: string;
  maxReplayThreshold?: number;
}

export interface ReplayResult {
  success: boolean;
  recordId: string;
  originalTopic: string;
  targetTopic: string;
  partition: number;
  offset: string;
  replayCount: number;
  routedToGraveyard: boolean;
  timestamp: string;
  replayedBy: string;
  error?: string;
}
