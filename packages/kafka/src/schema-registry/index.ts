export {
  SchemaRegistryClient,
  schemaRegistry,
  CONFLUENT_MAGIC_BYTE,
  WIRE_FORMAT_HEADER_LENGTH,
} from "./client.js";

export type {
  SchemaType,
  CompatibilityLevel,
  SchemaRegistryOptions,
  RegisteredSchema,
  SchemaRegistrationInput,
  DecodedMessage,
} from "./types.js";
