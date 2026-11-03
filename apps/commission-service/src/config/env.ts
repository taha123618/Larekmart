import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8022),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .default(
      "postgresql://postgres:admin123@localhost:5432/commission_db?sslmode=disable",
    ),
  DATABASE_READ_REPLICA_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("commission:v1:"),
  KAFKA_BROKERS: z.string().default("localhost:9094,localhost:9095,localhost:9096"),
  KAFKA_CLIENT_ID: z.string().default("commission-service"),
  KAFKA_GROUP_ID: z.string().default("commission-service-group"),
  INTERNAL_SERVICE_SECRET: z
    .string()
    .default("dev-shared-internal-secret-larekmart"),
  CLIENT_URL: z.string().default("http://localhost:3002"),
  ADMIN_URL: z.string().default("http://localhost:3003"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid commission-service environment variables:",
      result.error.format(),
    );
    throw new Error("Invalid environment variables");
  }
  return result.data;
}

export const env = loadEnv();
