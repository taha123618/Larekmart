export { createKafkaClient } from "./client";
export {
  createProducer,
  type KafkaProducer,
  type KafkaSendOptions,
} from "./producer";
export {
  createConsumer,
  type ConsumerRetryOptions,
  type KafkaBatchItem,
  type KafkaBatchConsumerConfig,
} from "./consumer";
export { initializeTopics, ALL_LAREKMART_TOPICS } from "./init-topics";
export { initializeSchemas, CORE_EVENT_SCHEMAS } from "./init-schemas";
export {
  createEventAttestation,
  verifyEventAttestation,
  type EventAttestationType,
  type AttestationPayloadInput,
  type VerifyAttestationInput,
} from "./attestation";
export {
  discoverDlqTopics,
  getDlqTopicSummaries,
  fetchDlqRecords,
  parseKafkaHeaders,
} from "./dlq/inspector";
export { replayDeadLetter, replayDeadLettersBatch } from "./dlq/replayer";
export { runDlqMirrorWorker } from "./dlq/mirror-worker";
export type {
  DeadLetterRecord,
  DeadLetterStatus,
  DeadLetterHeaders,
  DlqTopicSummary,
  ReplayOptions,
  ReplayResult,
} from "./dlq/types";
export {
  SchemaRegistryClient,
  schemaRegistry,
  CONFLUENT_MAGIC_BYTE,
  WIRE_FORMAT_HEADER_LENGTH,
  type SchemaType,
  type CompatibilityLevel,
  type SchemaRegistryOptions,
  type RegisteredSchema,
  type SchemaRegistrationInput,
  type DecodedMessage,
} from "./schema-registry/index";
