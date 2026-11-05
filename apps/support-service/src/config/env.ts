import { z } from "zod";
import { validateInternalServiceSecret } from "@repo/types";

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(8025),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z
      .string()
      .default(
        "postgresql://postgres:password123@localhost:5432/larekmart_support_db?schema=public",
      ),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    KAFKA_BROKERS: z
      .string()
      .default("localhost:9094,localhost:9095,localhost:9096"),
    ALLOWED_ORIGINS: z
      .string()
      .default(
        "http://localhost:3000,http://localhost:3002,http://localhost:3003",
      ),
    INTERNAL_SERVICE_SECRET: z
      .string()
      .default(
        process.env.GATEWAY_INTERNAL_SECRET ||
          process.env.INTERNAL_SERVICE_SECRET ||
          "dev_gateway_secret_change_in_production",
      ),
    GATEWAY_INTERNAL_SECRET: z
      .string()
      .default(
        process.env.INTERNAL_SERVICE_SECRET ||
          process.env.GATEWAY_INTERNAL_SECRET ||
          "dev_gateway_secret_change_in_production",
      ),
  })
  .superRefine((data, ctx) => {
    try {
      validateInternalServiceSecret(
        data.GATEWAY_INTERNAL_SECRET,
        data.NODE_ENV,
        "support-service",
      );
    } catch (err: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GATEWAY_INTERNAL_SECRET"],
        message: err.message,
      });
    }
  });

export type EnvConfig = z.infer<typeof EnvSchema>;

export const env: EnvConfig = EnvSchema.parse(process.env);
