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
