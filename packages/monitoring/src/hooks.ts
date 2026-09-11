import type { HttpRequestContext, KafkaEventContext } from "./types.js";
import type { Logger } from "./logger.js";
import type { MetricsRegistry } from "./metrics.js";

/**
 * Creates framework-agnostic monitoring hooks for HTTP requests.
 */
export function createHttpMonitor(logger: Logger, metrics: MetricsRegistry) {
  return {
    onRequestStart: (context: {
      method: string;
      url: string;
      requestId?: string;
      userId?: string;
    }) => {
      const startTime = performance.now();
      logger.debug(`HTTP Request Started: ${context.method} ${context.url}`, {
        method: context.method,
        url: context.url,
        requestId: context.requestId,
        userId: context.userId,
      });

      return {
        onRequestEnd: (
          statusCode: number,
          extraMeta: Record<string, unknown> = {},
        ) => {
          const durationMs =
            Math.round((performance.now() - startTime) * 100) / 100;
          metrics.recordHttpRequest(
            context.method,
            context.url,
            statusCode,
            durationMs,
          );

          const reqContext: HttpRequestContext = {
            method: context.method,
            url: context.url,
            statusCode,
            durationMs,
            requestId: context.requestId,
            userId: context.userId,
          };

          if (statusCode >= 500) {
            logger.error(
              `HTTP ${statusCode} ${context.method} ${context.url} (${durationMs}ms)`,
              undefined,
              {
                ...reqContext,
                ...extraMeta,
              },
            );
          } else if (statusCode >= 400) {
            logger.warn(
              `HTTP ${statusCode} ${context.method} ${context.url} (${durationMs}ms)`,
              {
                ...reqContext,
                ...extraMeta,
              },
            );
          } else {
            logger.info(
              `HTTP ${statusCode} ${context.method} ${context.url} (${durationMs}ms)`,
              {
                ...reqContext,
                ...extraMeta,
              },
            );
          }

          return reqContext;
        },
      };
    },
  };
}

/**
 * Creates framework-agnostic monitoring hooks for Kafka event processing.
 */
export function createKafkaMonitor(logger: Logger, metrics: MetricsRegistry) {
  return {
    onMessageStart: (topic: string, messageKey?: string) => {
      const startTime = performance.now();
      logger.debug(`Kafka Consumer processing message from topic '${topic}'`, {
        topic,
        messageKey,
      });

      return {
        onMessageComplete: (
          success: boolean,
          error?: Error,
          extraMeta: Record<string, unknown> = {},
        ) => {
          const durationMs =
            Math.round((performance.now() - startTime) * 100) / 100;
          metrics.recordKafkaEvent(topic, "consume", durationMs, success);

          const ctx: KafkaEventContext = {
            topic,
            messageKey,
            durationMs,
            success,
            error,
          };

          if (!success) {
            logger.error(
              `Kafka message processing failed on topic '${topic}' (${durationMs}ms)`,
              error,
              {
                ...ctx,
                ...extraMeta,
              },
            );
          } else {
            logger.info(
              `Kafka message processed successfully on topic '${topic}' (${durationMs}ms)`,
              {
                ...ctx,
                ...extraMeta,
              },
            );
          }

          return ctx;
        },
      };
    },

    onProduceEvent: async <T>(
      topic: string,
      sendFn: () => Promise<T>,
    ): Promise<T> => {
      const startTime = performance.now();
      try {
        const result = await sendFn();
        const durationMs =
          Math.round((performance.now() - startTime) * 100) / 100;
        metrics.recordKafkaEvent(topic, "produce", durationMs, true);
        logger.debug(
          `Kafka event published to topic '${topic}' (${durationMs}ms)`,
          {
            topic,
            durationMs,
          },
        );
        return result;
      } catch (err) {
        const durationMs =
          Math.round((performance.now() - startTime) * 100) / 100;
        metrics.recordKafkaEvent(topic, "produce", durationMs, false);
        logger.error(
          `Kafka event publication failed for topic '${topic}' (${durationMs}ms)`,
          err,
          {
            topic,
            durationMs,
          },
        );
        throw err;
      }
    },
  };
}

/**
 * Creates framework-agnostic monitoring hooks for Database operations.
 */
export function createDatabaseMonitor(
  logger: Logger,
  metrics: MetricsRegistry,
  dbType: "postgres" | "mongodb",
) {
  return {
    measureQuery: async <T>(
      operationName: string,
      queryFn: () => Promise<T>,
    ): Promise<T> => {
      const startTime = performance.now();
      try {
        const result = await queryFn();
        const durationMs =
          Math.round((performance.now() - startTime) * 100) / 100;
        metrics.recordDbQuery(dbType, operationName, durationMs, true);
        if (durationMs > 500) {
          logger.warn(
            `Slow ${dbType} query '${operationName}' took ${durationMs}ms`,
            {
              db: dbType,
              op: operationName,
              durationMs,
            },
          );
        }
        return result;
      } catch (err) {
        const durationMs =
          Math.round((performance.now() - startTime) * 100) / 100;
        metrics.recordDbQuery(dbType, operationName, durationMs, false);
        logger.error(
          `${dbType} query '${operationName}' failed (${durationMs}ms)`,
          err,
          {
            db: dbType,
            op: operationName,
            durationMs,
          },
        );
        throw err;
      }
    },
  };
}
