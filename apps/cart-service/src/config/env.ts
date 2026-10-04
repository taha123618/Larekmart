import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8009),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  MONGO_URL: z.string().default("mongodb://localhost:27017/ecommerce"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("cart:v1:"),
  KAFKA_BROKERS: z
    .string()
    .default("localhost:9092,localhost:9093,localhost:9094"),
  KAFKA_CLIENT_ID: z.string().default("cart-service"),
  KAFKA_GROUP_ID: z.string().default("cart-service-group"),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  PRODUCT_SERVICE_URL: z.string().default("http://localhost:8000"),
  INVENTORY_SERVICE_URL: z.string().default("http://localhost:8007"),
  GUEST_CART_TTL_SECONDS: z.coerce.number().default(7 * 24 * 60 * 60), // 7 days
  USER_CART_TTL_SECONDS: z.coerce.number().default(30 * 24 * 60 * 60), // 30 days
  CART_CACHE_TTL_SECONDS: z.coerce.number().default(300), // 5 minutes
  INTERNAL_SERVICE_SECRET: z
    .string()
    .default("dev-shared-internal-secret-larekmart"),
});

export const env = envSchema.parse(process.env);
