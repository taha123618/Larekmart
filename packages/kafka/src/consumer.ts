import type { Kafka, Consumer, Producer } from "kafkajs";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

/** Delay before the first retry during consumer connect/subscribe; doubles on every attempt. */
const RETRY_BASE_DELAY_MS = 2_000;
/** Upper bound so a permanently down broker does not back off into a hang. */
const RETRY_MAX_DELAY_MS = 30_000;
/** Total retry budget for broker operations. */
const RETRY_MAX_ATTEMPTS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ConsumerRetryOptions {
  /**
   * Whether to route failed messages to `<topic>.dlq` upon terminal failure.
   * Defaults to `true`.
   */
  enableDlq?: boolean;
  /**
   * Maximum handler execution retries before terminal DLQ routing.
   * Defaults to `3`.
   */
  maxRetries?: number;
  /**
   * Initial backoff delay for handler retries in milliseconds.
   * Defaults to `1000`.
   */
  initialRetryDelayMs?: number;
  /**
   * Exponential backoff multiplier.
   * Defaults to `2`.
   */
  backoffMultiplier?: number;
  /**
   * Suffix appended to topic name for dead-letter queue.
   * Defaults to `".dlq"`.
   */
  dlqTopicSuffix?: string;
}

export interface KafkaBatchItem<T = unknown> {
  topic: string;
  partition: number;
  offset: string;
  key?: Buffer | string | null;
  value: T;
  rawPayload: string;
  timestamp: string;
  headers: Record<string, string | undefined>;
}

export interface KafkaBatchConsumerConfig<T = unknown> {
  topicName: string;
  batchSize?: number;
  topicHandler: (batch: KafkaBatchItem<T>[]) => Promise<void>;
}

/**
 * Identifies deterministic poison pills (e.g. malformed JSON or schema validation failures)
 * that should bypass retry loops and route immediately to the DLQ.
 */
function isPoisonPill(error: unknown): boolean {
  if (error instanceof SyntaxError) {
    return true; // Malformed JSON payload
  }
  if (error && typeof error === "object" && "name" in error) {
    const errName = String(error.name);
    if (errName === "ZodError" || errName === "ValidationError") {
      return true; // Schema decoding failure
    }
  }
  return false;
}

export const createConsumer = (
  kafka: Kafka,
  groupId: string,
  options: ConsumerRetryOptions = {},
) => {
  const logger = createLogger(`kafka-consumer:${groupId}`);
  const consumer: Consumer = kafka.consumer({ groupId });

  const {
    enableDlq = true,
    maxRetries = 3,
    initialRetryDelayMs = 1_000,
    backoffMultiplier = 2,
    dlqTopicSuffix = ".dlq",
  } = options;

  let dlqProducer: Producer | null = null;

  const getDlqProducer = async (): Promise<Producer> => {
    if (!dlqProducer) {
      dlqProducer = kafka.producer();
      await dlqProducer.connect();
      logger.info(`Kafka DLQ producer connected for group [${groupId}]`);
    }
    return dlqProducer;
  };

  const dispatchToDlq = async (params: {
    topic: string;
    partition: number;
    offset: string;
    key?: Buffer | string | null;
    rawPayload: string;
    error: unknown;
    attemptCount: number;
    isPoisonPill: boolean;
  }): Promise<void> => {
    if (!enableDlq) return;

    const dlqTopic = `${params.topic}${dlqTopicSuffix}`;
    const errorMessage =
      params.error instanceof Error
        ? params.error.message
        : String(params.error);
    const errorName =
      params.error instanceof Error ? params.error.name : "UnknownError";
    const errorStack =
      params.error instanceof Error && params.error.stack
        ? params.error.stack.slice(0, 1000)
        : "";

    try {
      const producer = await getDlqProducer();
      await producer.send({
        topic: dlqTopic,
        messages: [
          {
            key: params.key ?? undefined,
            value: params.rawPayload,
            headers: {
              "x-original-topic": params.topic,
              "x-original-partition": String(params.partition),
              "x-original-offset": params.offset,
              "x-consumer-group": groupId,
              "x-error-message": errorMessage,
              "x-error-name": errorName,
              "x-error-stack": errorStack,
              "x-attempt-count": String(params.attemptCount),
              "x-is-poison-pill": String(params.isPoisonPill),
              "x-failed-at": new Date().toISOString(),
            },
          },
        ],
      });

      logger.warn(`Forwarded message to DLQ topic [${dlqTopic}]`, {
        originalTopic: params.topic,
        partition: params.partition,
        offset: params.offset,
        attemptCount: params.attemptCount,
        isPoisonPill: params.isPoisonPill,
        error: errorMessage,
      });
    } catch (dlqErr) {
      captureError(dlqErr, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: `consumer.dlq_dispatch_failed:${params.topic}`,
      });
    }
  };

  const retry = async <T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === RETRY_MAX_ATTEMPTS) break;
        const delay = Math.min(
          RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
          RETRY_MAX_DELAY_MS,
        );
        logger.warn(
          `Kafka consumer ${context} failed (attempt ${attempt}/${RETRY_MAX_ATTEMPTS}); retrying in ${delay}ms`,
          { error: String(error) },
        );
        await sleep(delay);
      }
    }
    throw lastError;
  };

  const connect = async () => {
    try {
      await retry(() => consumer.connect(), "connect");
      logger.info(`Kafka consumer connected for group [${groupId}]`);
    } catch (error) {
      captureError(error, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: "consumer.connect",
      });
      throw error;
    }
  };

  const subscribe = async (
    topics: {
      topicName: string;
      topicHandler: (message: any) => Promise<void>;
    }[],
  ) => {
    try {
      await retry(
        () =>
          consumer.subscribe({
            topics: topics.map((topic) => topic.topicName),
            fromBeginning: true,
          }),
        "subscribe",
      );

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const topicConfig = topics.find((t) => t.topicName === topic);
          if (!topicConfig) return;

          const rawValue = message.value?.toString();
          if (!rawValue) return;

          const offset = message.offset;
          let parsed: unknown;

          // Step 1: Parse JSON Payload (Poison-Pill Detection)
          try {
            parsed = JSON.parse(rawValue);
          } catch (parseError) {
            captureError(parseError, {
              serviceName: `kafka-consumer:${groupId}`,
              logger,
              context: `consumer.poison_pill_syntax_error:${topic}:partition-${partition}`,
            });

            await dispatchToDlq({
              topic,
              partition,
              offset,
              key: message.key,
              rawPayload: rawValue,
              error: parseError,
              attemptCount: 1,
              isPoisonPill: true,
            });
            return; // Poison pill handled; commit offset to prevent stalling partition
          }

          // Step 2: Handler execution with exponential backoff retries
          let lastError: unknown;
          let attempt = 1;

          while (attempt <= maxRetries) {
            try {
              await measureAsync(`kafka.handle.${topic}`, async () => {
                await topicConfig.topicHandler(parsed);
              });
              return; // Success!
            } catch (handlerError) {
              lastError = handlerError;

              // Check if handler error is a deterministic poison pill (e.g. Zod validation failure)
              if (isPoisonPill(handlerError)) {
                logger.warn(
                  `Detected deterministic poison pill in handler for [${topic}], skipping retries`,
                  { error: String(handlerError), attempt },
                );
                break;
              }

              if (attempt < maxRetries) {
                const delay = Math.min(
                  initialRetryDelayMs * backoffMultiplier ** (attempt - 1),
                  30_000,
                );
                logger.warn(
                  `Handler for [${topic}] failed (attempt ${attempt}/${maxRetries}); retrying in ${delay}ms`,
                  { error: String(handlerError) },
                );
                await sleep(delay);
              }
              attempt++;
            }
          }

          // Step 3: Terminal failure -> dispatch to DLQ
          captureError(lastError, {
            serviceName: `kafka-consumer:${groupId}`,
            logger,
            context: `consumer.terminal_failure:${topic}:partition-${partition}`,
          });

          await dispatchToDlq({
            topic,
            partition,
            offset,
            key: message.key,
            rawPayload: rawValue,
            error: lastError,
            attemptCount: attempt > maxRetries ? maxRetries : attempt,
            isPoisonPill: isPoisonPill(lastError),
          });
        },
      });
    } catch (error) {
      captureError(error, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: "consumer.subscribe",
      });
      throw error;
    }
  };

  const subscribeBatch = async (topics: KafkaBatchConsumerConfig[]) => {
    try {
      await retry(
        () =>
          consumer.subscribe({
            topics: topics.map((topic) => topic.topicName),
            fromBeginning: true,
          }),
        "subscribeBatch",
      );

      await consumer.run({
        eachBatchAutoResolve: false,
        eachBatch: async ({
          batch,
          resolveOffset,
          heartbeat,
          commitOffsetsIfNecessary,
          isRunning,
          isStale,
        }) => {
          const topicConfig = topics.find((t) => t.topicName === batch.topic);
          if (!topicConfig) return;

          const batchChunkLimit = topicConfig.batchSize || 100;
          const validItems: KafkaBatchItem[] = [];

          for (const message of batch.messages) {
            if (!isRunning() || isStale()) break;

            const rawValue = message.value?.toString();
            if (!rawValue) {
              resolveOffset(message.offset);
              continue;
            }

            // Step 1: Poison-Pill syntax parsing check
            let parsed: unknown;
            try {
              parsed = JSON.parse(rawValue);
            } catch (parseError) {
              captureError(parseError, {
                serviceName: `kafka-consumer:${groupId}`,
                logger,
                context: `consumer.batch_poison_pill:${batch.topic}:partition-${batch.partition}`,
              });

              await dispatchToDlq({
                topic: batch.topic,
                partition: batch.partition,
                offset: message.offset,
                key: message.key,
                rawPayload: rawValue,
                error: parseError,
                attemptCount: 1,
                isPoisonPill: true,
              });

              resolveOffset(message.offset);
              continue;
            }

            const headersRecord: Record<string, string | undefined> = {};
            if (message.headers) {
              for (const [k, v] of Object.entries(message.headers)) {
                headersRecord[k] = v?.toString();
              }
            }

            validItems.push({
              topic: batch.topic,
              partition: batch.partition,
              offset: message.offset,
              key: message.key,
              value: parsed,
              rawPayload: rawValue,
              timestamp: message.timestamp,
              headers: headersRecord,
            });
          }

          if (validItems.length === 0) {
            await commitOffsetsIfNecessary();
            return;
          }

          // Process in configured chunks
          for (let i = 0; i < validItems.length; i += batchChunkLimit) {
            if (!isRunning() || isStale()) break;

            const chunk = validItems.slice(i, i + batchChunkLimit);
            await heartbeat();

            let attempt = 1;
            let lastError: unknown;

            while (attempt <= maxRetries) {
              try {
                await measureAsync(
                  `kafka.handle_batch.${batch.topic}`,
                  async () => {
                    await topicConfig.topicHandler(chunk);
                  },
                );
                lastError = undefined;
                break;
              } catch (handlerError) {
                lastError = handlerError;
                if (isPoisonPill(handlerError)) {
                  logger.warn(
                    `Detected deterministic poison pill in batch handler for [${batch.topic}], routing chunk to DLQ`,
                    { error: String(handlerError) },
                  );
                  break;
                }

                if (attempt < maxRetries) {
                  const delay = Math.min(
                    initialRetryDelayMs * backoffMultiplier ** (attempt - 1),
                    30_000,
                  );
                  logger.warn(
                    `Batch handler for [${batch.topic}] failed (attempt ${attempt}/${maxRetries}); retrying in ${delay}ms`,
                    { error: String(handlerError), batchSize: chunk.length },
                  );
                  await sleep(delay);
                  await heartbeat();
                }
                attempt++;
              }
            }

            if (lastError && attempt > maxRetries) {
              captureError(lastError, {
                serviceName: `kafka-consumer:${groupId}`,
                logger,
                context: `consumer.batch_terminal_failure:${batch.topic}:partition-${batch.partition}`,
              });

              for (const item of chunk) {
                await dispatchToDlq({
                  topic: item.topic,
                  partition: item.partition,
                  offset: item.offset,
                  key: item.key,
                  rawPayload: item.rawPayload,
                  error: lastError,
                  attemptCount: maxRetries,
                  isPoisonPill: isPoisonPill(lastError),
                });
              }
            }

            for (const item of chunk) {
              resolveOffset(item.offset);
            }
            await heartbeat();
          }

          await commitOffsetsIfNecessary();
        },
      });
    } catch (error) {
      captureError(error, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: "consumer.subscribeBatch",
      });
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      if (dlqProducer) {
        await dlqProducer.disconnect();
        dlqProducer = null;
      }
      await consumer.disconnect();
      logger.info(`Kafka consumer disconnected for group [${groupId}]`);
    } catch (error) {
      captureError(error, {
        serviceName: `kafka-consumer:${groupId}`,
        logger,
        context: "consumer.disconnect",
      });
      throw error;
    }
  };

  return { connect, subscribe, subscribeBatch, disconnect };
};
