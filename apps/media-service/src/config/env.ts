import { z } from "zod";

/**
 * Zod-validated environment configuration.
 * The service fails fast at startup when configuration is invalid — never
 * operate with silently-missing credentials.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8013),

  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/media_db"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_KEY_PREFIX: z.string().default("media:v1:"),
  MEDIA_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  KAFKA_BROKERS: z.string().default("localhost:9094"),
  KAFKA_CLIENT_ID: z.string().default("media-service"),
  KAFKA_GROUP_ID: z.string().default("media-service-group"),

  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1).default("media"),
  S3_ACCESS_KEY_ID: z.string().min(1).default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  MEDIA_PRESIGN_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),

  MEDIA_MAX_FILE_SIZE: z.coerce.number().int().positive().default(10485760),
  MEDIA_UPLOAD_LIMITS: z
    .string()
    .default(
      '{"avatar":2097152,"product-image":10485760,"review-image":5242880,"seller-document":26214400,"marketing-image":10485760,"video":524288000}',
    )
    .transform((raw, ctx) => {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          ctx.addIssue({
            code: "custom",
            message: "MEDIA_UPLOAD_LIMITS must be a JSON object",
          });
          return z.NEVER;
        }
        const entries = Object.entries(
          parsed as Record<string, unknown>,
        ).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && entry[1] > 0,
        );
        if (entries.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "MEDIA_UPLOAD_LIMITS must define at least one category",
          });
          return z.NEVER;
        }
        return Object.fromEntries(entries);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "MEDIA_UPLOAD_LIMITS must be valid JSON",
        });
        return z.NEVER;
      }
    }),

  MEDIA_VARIANTS: z
    .string()
    .default("thumbnail:160,small:480,medium:960,large:1600")
    .transform((raw, ctx) => {
      const variants: { name: string; maxEdge: number }[] = [];
      for (const part of raw.split(",")) {
        const [name, edge] = part.split(":");
        const maxEdge = Number(edge);
        if (!name || !Number.isFinite(maxEdge) || maxEdge <= 0) {
          ctx.addIssue({
            code: "custom",
            message: `MEDIA_VARIANTS entry "${part}" must be name:positive-int`,
          });
          return z.NEVER;
        }
        variants.push({ name: name.trim(), maxEdge });
      }
      return variants;
    }),
  MEDIA_WORKER_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(2000),
  MEDIA_WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  /** PROCESSING jobs whose started_at is older than this are requeued. */
  MEDIA_WORKER_STALE_JOB_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  MEDIA_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  MEDIA_UPLOAD_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(86400),
  MEDIA_OWNER_TYPES: z
    .string()
    .default("product,seller,user,review,category,brand,collection,marketing")
    .transform((raw) =>
      raw
        .split(",")
        .map((type) => type.trim())
        .filter((type) => type.length > 0),
    ),

  /** Per-category generated variants: `name:edge` pairs, media-service picks
   *  the set from the upload category (avatars get avatar/thumbnail only). */
  MEDIA_CATEGORY_VARIANTS: z
    .string()
    .default(
      "product-image:thumbnail:160,small:480,medium:960,large:1600|review-image:thumbnail:160,medium:960|avatar:avatar:256,thumbnail:160",
    )
    .transform((raw, ctx) => {
      const map: Record<string, { name: string; maxEdge: number }[]> = {};
      for (const categoryChunk of raw.split("|")) {
        const [category, ...variantChunks] = categoryChunk.split(",");
        const variants: { name: string; maxEdge: number }[] = [];
        for (const chunk of variantChunks) {
          const [name, edge] = chunk.split(":");
          const maxEdge = Number(edge);
          if (!category || !name || !Number.isFinite(maxEdge) || maxEdge <= 0) {
            ctx.addIssue({
              code: "custom",
              message: `MEDIA_CATEGORY_VARIANTS entry "${chunk}" must be category:name:positive-int`,
            });
            return z.NEVER;
          }
          variants.push({ name: name.trim(), maxEdge });
        }
        if (category) map[category.trim()] = variants;
      }
      return map;
    }),

  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),

  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "fatal"])
    .default("info"),
  OTEL_SERVICE_NAME: z.string().default("media-service"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318"),

  MEDIA_DEV_AUTH_BYPASS: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "[media-service] Invalid environment configuration:",
    parsed.error.issues,
  );
  process.exit(1);
}

const envConfig = parsed.data;

/** Hard guard: the dev auth bypass must never survive into production. */
if (envConfig.NODE_ENV === "production" && envConfig.MEDIA_DEV_AUTH_BYPASS) {
  console.error(
    "[media-service] MEDIA_DEV_AUTH_BYPASS=true is forbidden when NODE_ENV=production",
  );
  process.exit(1);
}

export const env = {
  ...envConfig,

  isProduction: envConfig.NODE_ENV === "production",
  isDevAuthBypass: envConfig.MEDIA_DEV_AUTH_BYPASS,

  /** Per-category upload size limits (bytes), centrally defined. */
  uploadLimits: envConfig.MEDIA_UPLOAD_LIMITS as Record<string, number>,

  /** Configurable derived image variants (never hard-code these). */
  variants: envConfig.MEDIA_VARIANTS,

  /** Per-upload-category variant sets (avatar vs product vs review). */
  categoryVariants: envConfig.MEDIA_CATEGORY_VARIANTS as Record<
    string,
    { name: string; maxEdge: number }[]
  >,

  /** Configurable supported owner types. */
  ownerTypes: envConfig.MEDIA_OWNER_TYPES,
} as const;

export type MediaServiceEnv = typeof env;
