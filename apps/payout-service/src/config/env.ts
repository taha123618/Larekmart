import { z } from "zod";
import { validateInternalServiceSecret } from "@repo/types";

const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(8023),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .default(
        "postgresql://postgres:postgres@localhost:5432/larekmart_payout_db?schema=public",
      ),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    KAFKA_BROKERS: z.string().default("localhost:9092"),
    INTERNAL_SERVICE_SECRET: z
      .string()
      .default("dev-shared-internal-secret-larekmart"),
    CLERK_SECRET_KEY: z.string().default("sk_test_mock_secret_key_dev"),
    CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_mock_pubkey_dev"),
    PAYOUT_MIN_THRESHOLD: z.coerce.number().default(500),
    PAYOUT_RESERVE_PERCENTAGE: z.coerce.number().default(10),
    PAYOUT_HOLD_DAYS: z.coerce.number().default(14),
  })
  .superRefine((data, ctx) => {
    try {
      validateInternalServiceSecret(
        data.INTERNAL_SERVICE_SECRET,
        data.NODE_ENV,
        "payout-service",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INTERNAL_SERVICE_SECRET"],
        message,
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid environment variables in payout-service:",
      result.error.format(),
    );
    return EnvSchema.parse({});
  }
  return result.data;
}

export const env = getEnv();
