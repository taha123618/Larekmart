import { z } from "zod";

export const DEFAULT_INTERNAL_SECRET = "dev-shared-internal-secret-larekmart";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8019),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:password123@localhost:5432/pricing_db"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("pricing:v1:"),
  PRICING_CACHE_TTL_SECONDS: z.coerce.number().default(3600),
  KAFKA_BROKERS: z
    .string()
    .default("localhost:9092,localhost:9094,localhost:9096"),
  KAFKA_CLIENT_ID: z.string().default("pricing-service"),
  KAFKA_GROUP_ID: z.string().default("pricing-service-group"),
  CLERK_SECRET_KEY: z.string().default("sk_test_placeholder"),
  CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_placeholder"),
  INTERNAL_SERVICE_SECRET: z.string().default(DEFAULT_INTERNAL_SECRET),
  PROMOTION_SERVICE_URL: z.string().default("http://localhost:8016"),
  TAX_SERVICE_URL: z.string().default("http://localhost:8017"),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
