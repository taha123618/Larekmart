export type SchemaType = "JSON" | "AVRO" | "PROTOBUF";

export type CompatibilityLevel =
  | "BACKWARD"
  | "BACKWARD_TRANSITIVE"
  | "FORWARD"
  | "FORWARD_TRANSITIVE"
  | "FULL"
  | "FULL_TRANSITIVE"
  | "NONE";

export interface SchemaRegistryOptions {
  /** Schema Registry URL (default: process.env.SCHEMA_REGISTRY_URL || "http://localhost:8081") */
  baseUrl?: string;
  /** In-memory cache TTL in milliseconds (default: 300,000ms / 5 minutes) */
  cacheTtlMs?: number;
  /** Request timeout in milliseconds (default: 5,000ms) */
  timeoutMs?: number;
}

export interface RegisteredSchema {
  id: number;
  version: number;
  schema: string;
  schemaType: SchemaType;
  subject: string;
}

export interface SchemaRegistrationInput {
  schema: string | object;
  schemaType?: SchemaType;
  references?: Array<{
    name: string;
    subject: string;
    version: number;
  }>;
}

export interface DecodedMessage<T = unknown> {
  schemaId: number | null;
  payload: T;
  isWireFormat: boolean;
}
