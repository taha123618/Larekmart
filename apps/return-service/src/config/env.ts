import { z } from "zod";

export const DEFAULT_INTERNAL_SECRET = "dev-shared-internal-secret-larekmart";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(8018),
    HOST: z.string().default("0.0.0.0"),

    // MySQL connection parameters
    MYSQL_HOST: z.string().default("127.0.0.1"),
    MYSQL_PORT: z.coerce.number().default(3306),
    MYSQL_USER: z.string().default("root"),
    MYSQL_PASSWORD: z.string().default("rootpassword"),
    MYSQL_DATABASE: z.string().default("return_db"),
    DATABASE_URL: z.string().optional(),

    // Redis
    REDIS_URL: z.string().default("redis://localhost:6379"),
    RETURN_CACHE_TTL_SECONDS: z.coerce.number().default(3600),

    // Kafka
    KAFKA_BROKERS: z
      .string()
      .default("localhost:9092,localhost:9094,localhost:9096"),
    KAFKA_CLIENT_ID: z.string().default("return-service"),
    KAFKA_GROUP_ID: z.string().default("return-service-group"),

    // Auth
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .default("pk_test_mock_clerk_publishable_key"),
    CLERK_SECRET_KEY: z.string().default("sk_test_mock_clerk_secret_key"),
    GATEWAY_INTERNAL_SECRET: z.string().default(DEFAULT_INTERNAL_SECRET),

    // Outbox Worker
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(1000),
    OUTBOX_BATCH_SIZE: z.coerce.number().default(50),

    // Related Services
    TAX_SERVICE_URL: z.string().default("http://localhost:8017"),
    SHIPPING_SERVICE_URL: z.string().default("http://localhost:8011"),
    ALLOWED_ORIGINS: z
      .string()
      .default("http://localhost:3002,http://localhost:3003"),
  })
  .superRefine((data, ctx) => {
    if (
      data.NODE_ENV === "production" &&
      data.GATEWAY_INTERNAL_SECRET === DEFAULT_INTERNAL_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GATEWAY_INTERNAL_SECRET"],
        message:
          "In production, GATEWAY_INTERNAL_SECRET must be set to a secure secret instead of the default development placeholder.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid environment variables in return-service:",
      result.error.format(),
    );
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
