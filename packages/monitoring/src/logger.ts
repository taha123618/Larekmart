import type {
  Environment,
  LogEntry,
  LogLevel,
  LogMetadata,
  LoggerOptions,
} from "@repo/types";
import { getMonitoringConfig } from "./config.js";

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const ANSI_COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: ANSI_COLORS.cyan,
  info: ANSI_COLORS.green,
  warn: ANSI_COLORS.yellow,
  error: ANSI_COLORS.red,
  fatal: ANSI_COLORS.magenta,
};

function safeSerialize(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (typeof obj === "function")
    return `[Function: ${obj.name || "anonymous"}]`;
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
      ...(obj as unknown as Record<string, unknown>),
    };
  }
  if (typeof obj === "object") {
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map((item) => safeSerialize(item, seen));
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      output[key] = safeSerialize(value, seen);
    }
    return output;
  }
  return obj;
}

export class Logger {
  public readonly serviceName: string;
  public readonly environment: Environment;
  private minLevel: LogLevel;
  private defaultMetadata: LogMetadata;
  private prettyPrint: boolean;

  constructor(options: LoggerOptions) {
    const config = getMonitoringConfig(options.serviceName, {
      environment: options.environment,
      logLevel: options.minLevel,
      prettyLogs: options.prettyPrint,
    });

    this.serviceName = options.serviceName;
    this.environment = config.environment;
    this.minLevel = options.minLevel ?? config.logLevel;
    this.defaultMetadata = options.defaultMetadata ?? {};
    this.prettyPrint = options.prettyPrint ?? config.prettyLogs;
  }

  public setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public getLevel(): LogLevel {
    return this.minLevel;
  }

  public child(extraMetadata: LogMetadata = {}): Logger {
    return new Logger({
      serviceName: this.serviceName,
      environment: this.environment,
      minLevel: this.minLevel,
      prettyPrint: this.prettyPrint,
      defaultMetadata: {
        ...this.defaultMetadata,
        ...extraMetadata,
      },
    });
  }

  public debug(message: string, metadata?: LogMetadata): void {
    this.write("debug", message, metadata);
  }

  public info(message: string, metadata?: LogMetadata): void {
    this.write("info", message, metadata);
  }

  public warn(message: string, metadata?: LogMetadata, error?: Error): void {
    this.write("warn", message, metadata, error);
  }

  public error(
    message: string,
    errorOrMetadata?: Error | unknown,
    maybeMetadata?: LogMetadata,
  ): void {
    let err: Error | undefined;
    let meta: LogMetadata | undefined = maybeMetadata;

    if (errorOrMetadata instanceof Error) {
      err = errorOrMetadata;
    } else if (
      errorOrMetadata &&
      typeof errorOrMetadata === "object" &&
      !maybeMetadata
    ) {
      const record = errorOrMetadata as Record<string, unknown>;
      if (record.error instanceof Error) {
        err = record.error;
      } else if (typeof record.error === "string") {
        err = new Error(record.error);
      } else if (typeof record.message === "string") {
        err = new Error(record.message);
      }
      meta = errorOrMetadata as LogMetadata;
    } else if (errorOrMetadata !== undefined && errorOrMetadata !== null) {
      err = new Error(String(errorOrMetadata));
    }

    this.write("error", message, meta, err);
  }

  public fatal(
    message: string,
    errorOrMetadata?: Error | unknown,
    maybeMetadata?: LogMetadata,
  ): void {
    let err: Error | undefined;
    let meta: LogMetadata | undefined = maybeMetadata;

    if (errorOrMetadata instanceof Error) {
      err = errorOrMetadata;
    } else if (
      errorOrMetadata &&
      typeof errorOrMetadata === "object" &&
      !maybeMetadata
    ) {
      const record = errorOrMetadata as Record<string, unknown>;
      if (record.error instanceof Error) {
        err = record.error;
      } else if (typeof record.error === "string") {
        err = new Error(record.error);
      } else if (typeof record.message === "string") {
        err = new Error(record.message);
      }
      meta = errorOrMetadata as LogMetadata;
    } else if (errorOrMetadata !== undefined && errorOrMetadata !== null) {
      err = new Error(String(errorOrMetadata));
    }

    this.write("fatal", message, meta, err);
  }

  private write(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    error?: Error,
  ): void {
    if (LEVEL_WEIGHTS[level] < LEVEL_WEIGHTS[this.minLevel]) {
      return;
    }

    const mergedMetadata = {
      ...this.defaultMetadata,
      ...metadata,
    };

    const correlationId =
      typeof mergedMetadata.correlationId === "string"
        ? mergedMetadata.correlationId
        : undefined;
    const requestId =
      typeof mergedMetadata.requestId === "string"
        ? mergedMetadata.requestId
        : undefined;
    const userId =
      typeof mergedMetadata.userId === "string"
        ? mergedMetadata.userId
        : undefined;

    // Clean extracted top-level identifiers from nested metadata
    if (correlationId) delete mergedMetadata.correlationId;
    if (requestId) delete mergedMetadata.requestId;
    if (userId) delete mergedMetadata.userId;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      ...(correlationId && { correlationId }),
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...(Object.keys(mergedMetadata).length > 0 && {
        metadata: safeSerialize(mergedMetadata) as LogMetadata,
      }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...(error as unknown as Record<string, unknown>),
        },
      }),
    };

    if (this.prettyPrint) {
      this.writePretty(entry);
    } else {
      this.writeJson(entry);
    }
  }

  private writeJson(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    if (entry.level === "error" || entry.level === "fatal") {
      process.stderr.write(`${output}\n`);
    } else {
      process.stdout.write(`${output}\n`);
    }
  }

  private writePretty(entry: LogEntry): void {
    const color = LEVEL_COLORS[entry.level] || ANSI_COLORS.reset;
    const levelStr = `${color}[${entry.level.toUpperCase().padEnd(5)}]${ANSI_COLORS.reset}`;
    const timeStr = `${ANSI_COLORS.dim}${entry.timestamp.split("T")[1]?.replace("Z", "") || entry.timestamp}${ANSI_COLORS.reset}`;
    const serviceStr = `${ANSI_COLORS.dim}[${entry.service}]${ANSI_COLORS.reset}`;

    let reqCtx = "";
    if (entry.requestId) reqCtx += ` [req:${entry.requestId.slice(0, 8)}]`;
    if (entry.userId) reqCtx += ` [user:${entry.userId}]`;

    const line = `${timeStr} ${levelStr} ${serviceStr}${reqCtx} ${entry.message}`;

    if (entry.level === "error" || entry.level === "fatal") {
      console.error(line);
      if (entry.error?.stack) {
        console.error(
          `${ANSI_COLORS.red}${entry.error.stack}${ANSI_COLORS.reset}`,
        );
      } else if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        console.error(entry.metadata);
      }
    } else if (entry.level === "warn") {
      console.warn(line);
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        console.warn(entry.metadata);
      }
    } else {
      console.log(line);
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        console.log(entry.metadata);
      }
    }
  }
}

/**
 * Creates a structured logger instance for a given service.
 */
export function createLogger(
  serviceName: string,
  options: Partial<LoggerOptions> = {},
): Logger {
  return new Logger({
    serviceName,
    ...options,
  });
}
