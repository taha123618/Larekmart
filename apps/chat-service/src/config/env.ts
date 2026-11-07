import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(8026),
  DATABASE_URL: z
    .string()
    .default(
      "postgresql://postgres:admin123@localhost:5432/larekmart_chat_db?schema=public",
    ),
  DIRECT_URL: z
    .string()
    .default(
      "postgresql://postgres:admin123@localhost:5432/larekmart_chat_db?schema=public",
    ),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  KAFKA_BROKERS: z.string().default("localhost:9094,localhost:9095,localhost:9096"),
  INTERNAL_SERVICE_SECRET: z
    .string()
    .default("dev-shared-internal-secret-larekmart"),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_JWT_KEY: z.string().optional(),
  CLERK_JWT_HMAC_KEY: z.string().optional(),
  CLIENT_URL: z.string().default("http://localhost:3002"),
  ADMIN_URL: z.string().default("http://localhost:3003"),
  API_GATEWAY_URL: z.string().default("http://localhost:8080"),
  LOG_LEVEL: z.string().default("info"),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  REDIS_URL: process.env.REDIS_URL,
  KAFKA_BROKERS: process.env.KAFKA_BROKERS,
  INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_JWT_KEY: process.env.CLERK_JWT_KEY,
  CLERK_JWT_HMAC_KEY: process.env.CLERK_JWT_HMAC_KEY,
  CLIENT_URL: process.env.CLIENT_URL,
  ADMIN_URL: process.env.ADMIN_URL,
  API_GATEWAY_URL: process.env.API_GATEWAY_URL,
  LOG_LEVEL: process.env.LOG_LEVEL,
});
