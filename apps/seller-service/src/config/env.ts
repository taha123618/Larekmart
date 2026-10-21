import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8021),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/seller_db?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  KAFKA_BROKERS: z.string().default("localhost:9094,localhost:9095,localhost:9096"),
  INTERNAL_SERVICE_SECRET: z.string().default("dev-internal-secret-change-in-production"),
  CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_placeholder"),
  CLERK_SECRET_KEY: z.string().default("sk_test_placeholder"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
