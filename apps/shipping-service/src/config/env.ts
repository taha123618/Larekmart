import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8011),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z
    .string()
    .default(
      "postgresql://postgres:admin123@localhost:5432/larekmart_shipping_db?schema=public",
    ),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("shipping:v1:"),
  KAFKA_BROKERS: z
    .string()
    .default("localhost:9094,localhost:9095,localhost:9096"),
  KAFKA_CLIENT_ID: z.string().default("shipping-service"),
  KAFKA_GROUP_ID: z.string().default("shipping-service-group"),
  SHIPPING_RATE_CACHE_TTL_SECONDS: z.coerce.number().default(1800),
  TRACKING_CACHE_TTL_SECONDS: z.coerce.number().default(300),
  DEFAULT_CARRIER: z.string().default("custom"),
  WEBHOOK_SECRET: z.string().default("shipping_wh_secret_change_me"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
