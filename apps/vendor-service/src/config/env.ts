import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8020),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/vendor_db?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  KAFKA_BROKERS: z.string().default("localhost:9094,localhost:9095,localhost:9096"),
  GATEWAY_INTERNAL_SECRET: z.string().default("dev_gateway_secret_change_in_production"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const env: EnvConfig = EnvSchema.parse(process.env);
