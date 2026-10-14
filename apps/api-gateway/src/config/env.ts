import { z } from "zod";

export const DEFAULT_INTERNAL_SECRET = "dev-shared-internal-secret-larekmart";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(8080),
    HOST: z.string().default("0.0.0.0"),

    // CORS
    CORS_ORIGIN: z
      .string()
      .default(
        "http://localhost:3000,http://localhost:3002,http://localhost:3003",
      ),

    // Clerk Auth
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .default("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"),
    CLERK_SECRET_KEY: z
      .string()
      .default("sk_test_fake_secret_key_for_testing_12345"),

    // Internal Service Secret for propagation to backend services
    INTERNAL_SERVICE_SECRET: z.string().default(DEFAULT_INTERNAL_SECRET),

    // Redis
    REDIS_URL: z.string().default("redis://localhost:6379"),
    REDIS_KEY_PREFIX: z.string().default("gateway:v1:"),

    // Downstream Microservices
    PRODUCT_SERVICE_URL: z.string().default("http://localhost:8000"),
    ORDER_SERVICE_URL: z.string().default("http://localhost:8001"),
    PAYMENT_SERVICE_URL: z.string().default("http://localhost:8002"),
    AUTH_SERVICE_URL: z.string().default("http://localhost:8003"),
    ANALYTIC_SERVICE_URL: z.string().default("http://localhost:8004"),
    NOTIFICATION_SERVICE_URL: z.string().default("http://localhost:8005"),
    SEARCH_SERVICE_URL: z.string().default("http://localhost:8006"),
    INVENTORY_SERVICE_URL: z.string().default("http://localhost:8007"),
    RECOMMENDATION_SERVICE_URL: z.string().default("http://localhost:8008"),
    CART_SERVICE_URL: z.string().default("http://localhost:8009"),
    CATALOG_SERVICE_URL: z.string().default("http://localhost:8010"),
    SHIPPING_SERVICE_URL: z.string().default("http://localhost:8011"),
    USER_SERVICE_URL: z.string().default("http://localhost:8012"),
    MEDIA_SERVICE_URL: z.string().default("http://localhost:8013"),
    REVIEW_SERVICE_URL: z.string().default("http://localhost:8014"),
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
          "In production, INTERNAL_SERVICE_SECRET must be set to a secure, randomly generated secret instead of the default development placeholder.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid environment variables in api-gateway:",
      result.error.format(),
    );
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
