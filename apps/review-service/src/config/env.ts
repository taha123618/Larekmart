import { z } from "zod";
import { validateInternalServiceSecret } from "@repo/types";

const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(8014),
    HOST: z.string().default("0.0.0.0"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .default("postgresql://postgres:password123@localhost:5432/review_db"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    REDIS_KEY_PREFIX: z.string().default("review:v1:"),
    KAFKA_BROKERS: z.string().default("localhost:9092"),
    KAFKA_CLIENT_ID: z.string().default("review-service"),
    KAFKA_GROUP_ID: z.string().default("review-service-group"),
    CLERK_SECRET_KEY: z.string().default("sk_test_placeholder"),
    CLERK_PUBLISHABLE_KEY: z.string().default("pk_test_placeholder"),
    INTERNAL_SERVICE_SECRET: z
      .string()
      .default("dev-shared-internal-secret-larekmart"),
    AUTO_APPROVE_VERIFIED: z.coerce.boolean().default(true),
    REPORT_FLAG_THRESHOLD: z.coerce.number().default(3),
  })
  .superRefine((data, ctx) => {
    try {
      validateInternalServiceSecret(
        data.INTERNAL_SERVICE_SECRET,
        data.NODE_ENV,
        "review-service",
      );
    } catch (err: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INTERNAL_SERVICE_SECRET"],
        message: err.message,
      });
    }
  });

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
