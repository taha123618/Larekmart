/**
 * dlq.service.ts — Admin service for managing Kafka Dead-Letter Queues (DLQ),
 * full-text error inspection, and guarded replay.
 */

import { getApiGatewayUrl } from "./gateway.service";

const getAdminDlqBase = (): string => {
  const apiBase = getApiGatewayUrl();
  return `${apiBase}/api/v1/admin/dlq`;
};

function getHeaders(authToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface DlqTopicSummary {
  topic: string;
  originalTopic: string;
  partitions: number;
  totalMessages: number;
  oldestOffset: string;
  latestOffset: string;
}

export interface DeadLetterRecord {
  id: string;
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
  status: "PENDING" | "REPLAYED" | "PARKED_TERMINAL";
  replayedAt?: string;
  replayedBy?: string;
  payloadModified?: boolean;
}

export interface FetchDlqRecordsParams {
  topic?: string;
  status?: string;
  query?: string;
  isPoisonPill?: boolean;
  page?: number;
  limit?: number;
}

export interface DlqRecordsResponse {
  success: boolean;
  source: string;
  records: DeadLetterRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReplayDlqPayload {
  recordId: string;
  dlqTopic: string;
  partition: number;
  offset: string;
  targetTopic?: string;
  modifiedPayload?: string;
  maxReplayThreshold?: number;
}

export interface ReplayDlqResponse {
  success: boolean;
  message: string;
  data: {
    recordId: string;
    originalTopic: string;
    targetTopic: string;
    partition: number;
    offset: string;
    replayCount: number;
    routedToGraveyard: boolean;
    timestamp: string;
    replayedBy: string;
  };
}

/**
 * Fetch all DLQ topics and their partition backlog counts.
 */
export async function fetchAdminDlqTopics(
  authToken?: string | null,
): Promise<DlqTopicSummary[]> {
  const res = await fetch(`${getAdminDlqBase()}/topics`, {
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch DLQ topics (HTTP ${res.status})`,
    );
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Search dead-letter records with full-text search and filters.
 */
export async function fetchAdminDlqRecords(
  params?: FetchDlqRecordsParams,
  authToken?: string | null,
): Promise<DlqRecordsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.topic && params.topic !== "ALL")
    searchParams.set("topic", params.topic);
  if (params?.status && params.status !== "ALL")
    searchParams.set("status", params.status);
  if (params?.query) searchParams.set("q", params.query);
  if (params?.isPoisonPill !== undefined)
    searchParams.set("isPoisonPill", String(params.isPoisonPill));
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const url = `${getAdminDlqBase()}/records${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to search DLQ records (HTTP ${res.status})`,
    );
  }

  return await res.json();
}

/**
 * Replay a dead-letter record back to its source topic or graveyard.
 */
export async function replayAdminDlqRecord(
  payload: ReplayDlqPayload,
  authToken?: string | null,
): Promise<ReplayDlqResponse> {
  const res = await fetch(`${getAdminDlqBase()}/replay`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to replay DLQ record (HTTP ${res.status})`,
    );
  }

  return await res.json();
}
