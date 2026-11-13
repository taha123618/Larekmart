import type { Client } from "@opensearch-project/opensearch";
import type { Logger } from "@repo/monitoring";

export type DeadLetterStatus = "PENDING" | "REPLAYED" | "PARKED_TERMINAL";

export interface DeadLetterRecord {
  id: string;
  originalTopic: string;
  dlqTopic: string;
  partition: number;
  offset: string;
  key: string | null;
  consumerGroup: string;
  isPoisonPill: boolean;
  errorMessage: string;
  errorName: string;
  errorStack: string;
  attemptCount: number;
  replayCount: number;
  status: DeadLetterStatus;
  rawPayload: string;
  parsedPayload?: Record<string, unknown> | null;
  failedAt: string;
  replayedAt?: string;
  replayedBy?: string;
  payloadModified?: boolean;
}

export const DLQ_INDEX_NAME = "larekmart-dlq-records";

export const DLQ_INDEX_SETTINGS = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    refresh_interval: "1s",
  },
  mappings: {
    properties: {
      id: { type: "keyword" },
      originalTopic: { type: "keyword" },
      dlqTopic: { type: "keyword" },
      partition: { type: "integer" },
      offset: { type: "keyword" },
      key: { type: "keyword" },
      consumerGroup: { type: "keyword" },
      isPoisonPill: { type: "boolean" },
      errorMessage: { type: "text", analyzer: "standard" },
      errorName: { type: "keyword" },
      errorStack: { type: "text" },
      attemptCount: { type: "integer" },
      replayCount: { type: "integer" },
      status: { type: "keyword" },
      rawPayload: { type: "text" },
      failedAt: { type: "date" },
      replayedAt: { type: "date" },
      replayedBy: { type: "keyword" },
      payloadModified: { type: "boolean" },
    },
  },
};

export interface DlqSearchParams {
  topic?: string;
  status?: DeadLetterStatus;
  isPoisonPill?: boolean;
  query?: string;
  page?: number;
  limit?: number;
}

export interface DlqSearchResult {
  records: DeadLetterRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Ensures the DLQ audit index exists in OpenSearch.
 */
export async function ensureDlqIndexExists(
  client: Client,
  logger?: Logger,
): Promise<void> {
  try {
    const existsResponse = await client.indices.exists({
      index: DLQ_INDEX_NAME,
    });
    if (!existsResponse.body) {
      logger?.info(`Creating OpenSearch DLQ index: ${DLQ_INDEX_NAME}`);
      await client.indices.create({
        index: DLQ_INDEX_NAME,
        body: DLQ_INDEX_SETTINGS as any,
      });
      logger?.info(
        `OpenSearch DLQ index ${DLQ_INDEX_NAME} created successfully`,
      );
    }
  } catch (error) {
    logger?.error(
      `Failed to ensure DLQ index ${DLQ_INDEX_NAME} exists`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Index or update a DeadLetterRecord into OpenSearch.
 */
export async function indexDlqRecord(
  client: Client,
  record: DeadLetterRecord,
  logger?: Logger,
): Promise<void> {
  try {
    await client.index({
      index: DLQ_INDEX_NAME,
      id: record.id,
      body: {
        id: record.id,
        originalTopic: record.originalTopic,
        dlqTopic: record.dlqTopic,
        partition: record.partition,
        offset: record.offset,
        key: record.key,
        consumerGroup: record.consumerGroup,
        isPoisonPill: record.isPoisonPill,
        errorMessage: record.errorMessage,
        errorName: record.errorName,
        errorStack: record.errorStack,
        attemptCount: record.attemptCount,
        replayCount: record.replayCount,
        status: record.status,
        rawPayload: record.rawPayload,
        failedAt: record.failedAt,
        replayedAt: record.replayedAt,
        replayedBy: record.replayedBy,
        payloadModified: record.payloadModified,
      },
      refresh: true,
    });
  } catch (error) {
    logger?.error(
      `Failed to index DLQ record ${record.id} in OpenSearch`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Full-text search and filtering across indexed dead-letter records.
 */
export async function searchDlqRecords(
  client: Client,
  params: DlqSearchParams,
  logger?: Logger,
): Promise<DlqSearchResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const from = (page - 1) * limit;

  const mustClauses: Record<string, unknown>[] = [];

  if (params.topic) {
    mustClauses.push({
      term: { originalTopic: params.topic },
    });
  }

  if (params.status) {
    mustClauses.push({
      term: { status: params.status },
    });
  }

  if (params.isPoisonPill !== undefined) {
    mustClauses.push({
      term: { isPoisonPill: params.isPoisonPill },
    });
  }

  if (params.query && params.query.trim().length > 0) {
    mustClauses.push({
      multi_match: {
        query: params.query.trim(),
        fields: [
          "errorMessage^3",
          "errorName^2",
          "rawPayload",
          "consumerGroup",
        ],
        fuzziness: "AUTO",
      },
    });
  }

  const bodyQuery =
    mustClauses.length > 0
      ? { bool: { must: mustClauses } }
      : { match_all: {} };

  try {
    const response = await client.search({
      index: DLQ_INDEX_NAME,
      body: {
        from,
        size: limit,
        sort: [{ failedAt: { order: "desc" } }],
        query: bodyQuery,
      },
    });

    const total =
      typeof response.body.hits.total === "number"
        ? response.body.hits.total
        : response.body.hits.total?.value || 0;

    const records: DeadLetterRecord[] = response.body.hits.hits.map(
      (hit: any) => {
        const src = hit._source;
        let parsedPayload = null;
        try {
          parsedPayload = JSON.parse(src.rawPayload);
        } catch {
          // Keep null
        }
        return {
          ...src,
          parsedPayload,
        };
      },
    );

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (error) {
    logger?.error(
      "Failed to execute searchDlqRecords against OpenSearch",
      error instanceof Error ? error : new Error(String(error)),
    );
    return {
      records: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }
}
