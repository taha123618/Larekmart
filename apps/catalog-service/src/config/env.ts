import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8010),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .default(
      "postgresql://postgres:postgres@localhost:5432/catalog_db?schema=public",
    ),
  DATABASE_READ_REPLICA_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("catalog:v1:"),
  KAFKA_BROKERS: z
    .string()
    .default("localhost:9094,localhost:9095,localhost:9096"),
  KAFKA_CLIENT_ID: z.string().default("catalog-service"),
  KAFKA_GROUP_ID: z.string().default("catalog-service-group"),
  CATALOG_CACHE_TTL_SECONDS: z.coerce.number().default(3600), // 1 hour default
});

export const env = envSchema.parse(process.env);
