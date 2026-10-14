import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8015),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:password123@localhost:5432/wishlist_db"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("wishlist:v1:"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("wishlist-service"),
  KAFKA_GROUP_ID: z.string().default("wishlist-service-group"),
  CLERK_SECRET_KEY: z.string().default("sk_test_placeholder"),
  CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_placeholder"),
  INTERNAL_SERVICE_SECRET: z
    .string()
    .default("dev-shared-internal-secret-larekmart"),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
