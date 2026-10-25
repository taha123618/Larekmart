import { z } from "zod";
import { validateInternalServiceSecret } from "@repo/types";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(8012),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .default(
        "postgresql://postgres:password123@localhost:5432/user_db?schema=public",
      ),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    REDIS_KEY_PREFIX: z.string().default("user:v1:"),
    KAFKA_BROKERS: z
      .string()
      .default("localhost:9094,localhost:9095,localhost:9096"),
    KAFKA_CLIENT_ID: z.string().default("user-service"),
    KAFKA_GROUP_ID: z.string().default("user-service-group"),
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .default("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"),
    CLERK_SECRET_KEY: z
      .string()
      .default("sk_test_123456789012345678901234567890"),
    INTERNAL_SERVICE_SECRET: z
      .string()
      .default("dev-shared-internal-secret-larekmart"),
    ALLOWED_ORIGINS: z
      .string()
      .default(
        "http://localhost:3000,http://localhost:3002,http://localhost:3003",
      ),
  })
  .superRefine((data, ctx) => {
    try {
      validateInternalServiceSecret(
        data.INTERNAL_SERVICE_SECRET,
        data.NODE_ENV,
        "user-service",
      );
    } catch (err: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INTERNAL_SERVICE_SECRET"],
        message: err.message,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
export const env: Env = envSchema.parse(process.env);

// Backward-compatible config object
export interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  redisUrl: string;
  kafkaBrokers: string[];
  clerkPublishableKey?: string;
  clerkSecretKey?: string;
  internalServiceSecret: string;
  allowedOrigins: string[];
}

export const config: Config = {
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  redisUrl: env.REDIS_URL,
  kafkaBrokers: env.KAFKA_BROKERS.split(","),
  clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY,
  clerkSecretKey: env.CLERK_SECRET_KEY,
  internalServiceSecret: env.INTERNAL_SERVICE_SECRET,
  allowedOrigins: env.ALLOWED_ORIGINS.split(","),
};
