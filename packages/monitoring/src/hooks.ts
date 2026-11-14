import type { HttpRequestContext, KafkaEventContext } from "@repo/types";
import type { Logger } from "./logger.js";
import type { MetricsRegistry } from "./metrics.js";
import { Tracer, Span } from "./tracing/tracer.js";
import { getTraceContext, type TraceContext } from "./tracing/context.js";
import { generateTraceId, generateSpanId } from "./tracing/w3c.js";

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

      const parentCtx = getTraceContext();
      const traceId = parentCtx?.traceId || generateTraceId();
      const spanId = generateSpanId();
      const currentCtx: TraceContext = {
        traceId,
        spanId,
        parentSpanId: parentCtx?.spanId,
        correlationId: parentCtx?.correlationId,
        sampled: parentCtx?.sampled ?? true,
      };

      const routeName = context.url.split("?")[0] || "/";
      const span = new Span(
        `${context.method} ${routeName}`,
        currentCtx,
        Tracer.getInstance().getServiceName(),
        {
          kind: "SERVER",
          attributes: {
            "http.method": context.method,
            "http.url": context.url,
            "http.route": routeName,
            "http.request_id": context.requestId,
            "user.id": context.userId,
          },
        },
      );

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

          span.setAttributes({
            "http.status_code": statusCode,
            "http.duration_ms": durationMs,
          });
          if (statusCode >= 500) {
            span.setStatus("ERROR", `HTTP ${statusCode}`);
          } else {
            span.setStatus("OK");
          }
          span.end();

          const reqContext: HttpRequestContext = {
            method: context.method,
            url: context.url,
            statusCode,
            durationMs,
            requestId:
              (extraMeta.requestId as string) || context.requestId || undefined,
            userId: (extraMeta.userId as string) || context.userId || undefined,
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

      const parentCtx = getTraceContext();
      const traceId = parentCtx?.traceId || generateTraceId();
      const spanId = generateSpanId();
      const currentCtx: TraceContext = {
        traceId,
        spanId,
        parentSpanId: parentCtx?.spanId,
        correlationId: parentCtx?.correlationId,
        sampled: parentCtx?.sampled ?? true,
      };

      const span = new Span(
        `kafka.consume ${topic}`,
        currentCtx,
        Tracer.getInstance().getServiceName(),
        {
          kind: "CONSUMER",
          attributes: {
            "messaging.system": "kafka",
            "messaging.destination": topic,
            "messaging.message_id": messageKey,
          },
        },
      );

      return {
        onMessageComplete: (
          success: boolean,
          error?: Error,
          extraMeta: Record<string, unknown> = {},
        ) => {
          const durationMs =
            Math.round((performance.now() - startTime) * 100) / 100;
          metrics.recordKafkaEvent(topic, "consume", durationMs, success);

          if (!success) {
            span.setStatus(
              "ERROR",
              error?.message || "Kafka message processing failed",
            );
            if (error) span.recordException(error);
          } else {
            span.setStatus("OK");
          }
          span.end();

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
      const parentCtx = getTraceContext();
      const traceId = parentCtx?.traceId || generateTraceId();
      const spanId = generateSpanId();
      const currentCtx: TraceContext = {
        traceId,
        spanId,
        parentSpanId: parentCtx?.spanId,
        correlationId: parentCtx?.correlationId,
        sampled: parentCtx?.sampled ?? true,
      };

      const span = new Span(
        `kafka.produce ${topic}`,
        currentCtx,
        Tracer.getInstance().getServiceName(),
        {
          kind: "PRODUCER",
          attributes: {
            "messaging.system": "kafka",
            "messaging.destination": topic,
          },
        },
      );

      try {
        const result = await sendFn();
        const durationMs =
          Math.round((performance.now() - startTime) * 100) / 100;
        metrics.recordKafkaEvent(topic, "produce", durationMs, true);
        span.setStatus("OK");
        span.setAttributes({ "messaging.duration_ms": durationMs });
        span.end();
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
        span.setStatus(
          "ERROR",
          err instanceof Error ? err.message : String(err),
        );
        span.recordException(err);
        span.end();
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
      const parentCtx = getTraceContext();
      const traceId = parentCtx?.traceId || generateTraceId();
      const spanId = generateSpanId();
      const currentCtx: TraceContext = {
        traceId,
        spanId,
        parentSpanId: parentCtx?.spanId,
        correlationId: parentCtx?.correlationId,
        sampled: parentCtx?.sampled ?? true,
      };

      const span = new Span(
        `${dbType} ${operationName}`,
        currentCtx,
        Tracer.getInstance().getServiceName(),
        {
          kind: "CLIENT",
          attributes: {
            "db.system": dbType,
            "db.operation": operationName,
          },
        },
      );

      try {
        const result = await queryFn();
        const durationMs =
          Math.round((performance.now() - startTime) * 100) / 100;
        metrics.recordDbQuery(dbType, operationName, durationMs, true);
        span.setStatus("OK");
        span.setAttributes({ "db.duration_ms": durationMs });
        span.end();
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
        span.setStatus(
          "ERROR",
          err instanceof Error ? err.message : String(err),
        );
        span.recordException(err);
        span.end();
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
