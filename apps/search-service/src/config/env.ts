import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(8006),
  HOST: z.string().default("0.0.0.0"),

  // OpenSearch
  OPENSEARCH_NODE: z.string().default("http://localhost:9200"),
  OPENSEARCH_USERNAME: z.string().optional(),
  OPENSEARCH_PASSWORD: z.string().optional(),
  OPENSEARCH_INDEX: z.string().default("products-v1"),
  OPENSEARCH_ALIAS: z.string().default("products"),
  OPENSEARCH_REQUEST_TIMEOUT: z.coerce.number().default(5000),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("search:v1:"),
  SEARCH_CACHE_TTL_SECONDS: z.coerce.number().default(300),
  SUGGESTION_CACHE_TTL_SECONDS: z.coerce.number().default(600),

  // Kafka
  KAFKA_BROKERS: z
    .string()
    .default("localhost:9094,localhost:9095,localhost:9096"),
  KAFKA_GROUP_ID: z.string().default("search-service-group"),
  KAFKA_CLIENT_ID: z.string().default("search-service"),

  // Auth & Security
  CLERK_SECRET_KEY: z.string().optional(),

  // Observability
  LOG_LEVEL: z.string().default("info"),
  OTEL_SERVICE_NAME: z.string().default("search-service"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
