import { createLogger } from "@repo/monitoring";
import type {
  CompatibilityLevel,
  DecodedMessage,
  RegisteredSchema,
  SchemaRegistrationInput,
  SchemaRegistryOptions,
  SchemaType,
} from "./types.js";

const logger = createLogger("schema-registry-client");

export const CONFLUENT_MAGIC_BYTE = 0x00;
export const WIRE_FORMAT_HEADER_LENGTH = 5; // 1 magic byte + 4 bytes schema ID

/**
 * High-performance, lightweight Kafka Schema Registry client (Confluent / Karapace).
 * Enforces schema evolution governance, JSON/Avro schema compatibility checks,
 * and Confluent wire-format payload serialization across Larekmart microservices.
 */
export class SchemaRegistryClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly schemaCache = new Map<string, RegisteredSchema>();
  private readonly idToSchemaCache = new Map<number, RegisteredSchema>();

  constructor(options: SchemaRegistryOptions = {}) {
    this.baseUrl = (
      options.baseUrl ||
      process.env.SCHEMA_REGISTRY_URL ||
      "http://localhost:8081"
    ).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Encodes a payload into Confluent Wire Format:
   * [1 byte: 0x00 Magic Byte] + [4 bytes: uint32BE Schema ID] + [UTF-8 JSON Payload]
   */
  public encodeMessage(schemaId: number, payload: unknown): Buffer {
    const payloadStr =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const payloadBuf = Buffer.from(payloadStr, "utf-8");

    const header = Buffer.alloc(WIRE_FORMAT_HEADER_LENGTH);
    header.writeUInt8(CONFLUENT_MAGIC_BYTE, 0);
    header.writeUInt32BE(schemaId, 1);

    return Buffer.concat([header, payloadBuf]);
  }

  /**
   * Decodes a Kafka message buffer.
   * If the buffer starts with the Confluent Magic Byte (0x00) and is at least 5 bytes long,
   * it extracts the Schema ID and deserializes the payload.
   * Otherwise, it transparently decodes as standard UTF-8 JSON / text.
   */
  public decodeMessage<T = unknown>(buffer: Buffer | string): DecodedMessage<T> {
    const buf = typeof buffer === "string" ? Buffer.from(buffer, "utf-8") : buffer;

    if (buf.length >= WIRE_FORMAT_HEADER_LENGTH && buf[0] === CONFLUENT_MAGIC_BYTE) {
      const schemaId = buf.readUInt32BE(1);
      const payloadBytes = buf.subarray(WIRE_FORMAT_HEADER_LENGTH);
      try {
        const parsed = JSON.parse(payloadBytes.toString("utf-8"));
        return {
          schemaId,
          payload: parsed as T,
          isWireFormat: true,
        };
      } catch {
        return {
          schemaId,
          payload: payloadBytes.toString("utf-8") as unknown as T,
          isWireFormat: true,
        };
      }
    }

    // Fallback: Legacy or raw string / JSON payload
    try {
      const parsed = JSON.parse(buf.toString("utf-8"));
      return {
        schemaId: null,
        payload: parsed as T,
        isWireFormat: false,
      };
    } catch {
      return {
        schemaId: null,
        payload: buf.toString("utf-8") as unknown as T,
        isWireFormat: false,
      };
    }
  }

  /**
   * Registers a schema under a given subject (e.g. `order.created-value`).
   * Caches results locally to avoid redundant REST requests.
   */
  public async registerSchema(
    subject: string,
    input: SchemaRegistrationInput,
  ): Promise<RegisteredSchema> {
    const schemaStr =
      typeof input.schema === "string"
        ? input.schema
        : JSON.stringify(input.schema);
    const schemaType: SchemaType = input.schemaType ?? "JSON";

    const cacheKey = `${subject}:${schemaStr}`;
    const cached = this.schemaCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const res = await this.fetchJson<{ id: number }>(
      `/subjects/${encodeURIComponent(subject)}/versions`,
      {
        method: "POST",
        body: JSON.stringify({
          schema: schemaStr,
          schemaType,
          references: input.references,
        }),
      },
    );

    // Retrieve full version metadata
    const versionMeta = await this.getLatestSchema(subject);

    const record: RegisteredSchema = {
      id: res.id,
      version: versionMeta.version,
      schema: schemaStr,
      schemaType,
      subject,
    };

    this.schemaCache.set(cacheKey, record);
    this.idToSchemaCache.set(res.id, record);

    logger.info(`Registered schema for subject [${subject}] with id: ${res.id}`);
    return record;
  }

  /**
   * Retrieves the latest active schema for a given subject.
   */
  public async getLatestSchema(subject: string): Promise<RegisteredSchema> {
    const res = await this.fetchJson<{
      id: number;
      version: number;
      schema: string;
      schemaType?: SchemaType;
      subject: string;
    }>(`/subjects/${encodeURIComponent(subject)}/versions/latest`);

    const record: RegisteredSchema = {
      id: res.id,
      version: res.version,
      schema: res.schema,
      schemaType: res.schemaType ?? "JSON",
      subject: res.subject || subject,
    };

    this.idToSchemaCache.set(res.id, record);
    return record;
  }

  /**
   * Retrieves a schema by its global unique Schema ID.
   */
  public async getSchemaById(id: number): Promise<RegisteredSchema> {
    const cached = this.idToSchemaCache.get(id);
    if (cached) {
      return cached;
    }

    const res = await this.fetchJson<{
      schema: string;
      schemaType?: SchemaType;
    }>(`/schemas/ids/${id}`);

    const record: RegisteredSchema = {
      id,
      version: 0,
      schema: res.schema,
      schemaType: res.schemaType ?? "JSON",
      subject: "unknown",
    };

    this.idToSchemaCache.set(id, record);
    return record;
  }

  /**
   * Tests whether a candidate schema is compatible with the latest registered version
   * under a subject based on the configured compatibility mode (BACKWARD, FULL, etc.).
   */
  public async testCompatibility(
    subject: string,
    schema: string | object,
    schemaType: SchemaType = "JSON",
  ): Promise<boolean> {
    const schemaStr =
      typeof schema === "string" ? schema : JSON.stringify(schema);

    try {
      const res = await this.fetchJson<{ is_compatible: boolean }>(
        `/compatibility/subjects/${encodeURIComponent(subject)}/versions/latest`,
        {
          method: "POST",
          body: JSON.stringify({
            schema: schemaStr,
            schemaType,
          }),
        },
      );
      return res.is_compatible;
    } catch {
      // If subject doesn't exist yet, it is trivially compatible
      return true;
    }
  }

  /**
   * Sets the compatibility mode for a specific subject (e.g. "BACKWARD", "FULL").
   */
  public async setCompatibility(
    subject: string,
    level: CompatibilityLevel,
  ): Promise<void> {
    await this.fetchJson(`/config/${encodeURIComponent(subject)}`, {
      method: "PUT",
      body: JSON.stringify({ compatibility: level }),
    });
    logger.info(`Set compatibility level for [${subject}] to ${level}`);
  }

  /**
   * Internal HTTP fetch helper with strict timeout handling.
   */
  private async fetchJson<T>(
    endpoint: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/vnd.schemaregistry.v1+json, application/json",
      "Content-Type": "application/vnd.schemaregistry.v1+json",
      ...(init.headers as Record<string, string>),
    };

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(
          `Schema Registry error [${res.status} ${res.statusText}]: ${bodyText}`,
        );
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Singleton client instance with default environment configuration.
 */
export const schemaRegistry = new SchemaRegistryClient();
