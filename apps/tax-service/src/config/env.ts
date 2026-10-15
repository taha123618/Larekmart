import { z } from "zod";

export const DEFAULT_INTERNAL_SECRET = "dev-shared-internal-secret-larekmart";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(8017),
    HOST: z.string().default("0.0.0.0"),

    // MySQL connection parameters
    MYSQL_HOST: z.string().default("127.0.0.1"),
    MYSQL_PORT: z.coerce.number().default(3306),
    MYSQL_USER: z.string().default("root"),
    MYSQL_PASSWORD: z.string().default("mysql_root_password_123"),
    MYSQL_DATABASE: z.string().default("tax_db"),
    MYSQL_URL: z.string().optional(),

    // Redis
    REDIS_URL: z.string().default("redis://localhost:6379"),
    TAX_CACHE_TTL_SECONDS: z.coerce.number().default(3600),

    // Kafka
    KAFKA_BROKERS: z.string().default("localhost:9092"),

    // Auth
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .default("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"),
    CLERK_SECRET_KEY: z
      .string()
      .default("sk_test_fake_secret_key_for_testing_12345"),
    INTERNAL_SERVICE_SECRET: z.string().default(DEFAULT_INTERNAL_SECRET),

    // Tax Provider Adapter
    TAX_PROVIDER: z.enum(["standard", "external"]).default("standard"),
    TAX_PROVIDER_API_KEY: z.string().optional().default(""),
    TAX_PROVIDER_ENDPOINT: z.string().optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (
      data.NODE_ENV === "production" &&
      data.INTERNAL_SERVICE_SECRET === DEFAULT_INTERNAL_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INTERNAL_SERVICE_SECRET"],
        message:
          "In production, INTERNAL_SERVICE_SECRET must be set to a secure secret instead of the default development placeholder.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid environment variables in tax-service:",
      result.error.format(),
    );
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
