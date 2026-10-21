import { env } from "./env.js";

export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    isDev: env.NODE_ENV === "development",
    isProd: env.NODE_ENV === "production",
  },
  opensearch: {
    node: env.OPENSEARCH_NODE,
    auth:
      env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD
        ? {
            username: env.OPENSEARCH_USERNAME,
            password: env.OPENSEARCH_PASSWORD,
          }
        : undefined,
    indexName: env.OPENSEARCH_INDEX,
    aliasName: env.OPENSEARCH_ALIAS,
    requestTimeout: env.OPENSEARCH_REQUEST_TIMEOUT,
    maxRetries: 3,
  },
  redis: {
    url: env.REDIS_URL,
    keyPrefix: env.REDIS_KEY_PREFIX,
    searchCacheTtl: env.SEARCH_CACHE_TTL_SECONDS,
    suggestionCacheTtl: env.SUGGESTION_CACHE_TTL_SECONDS,
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 120,
  },
  kafka: {
    brokers: env.KAFKA_BROKERS.split(",").map((b) => b.trim()),
    groupId: env.KAFKA_GROUP_ID,
    clientId: env.KAFKA_CLIENT_ID,
    topics: {
      productCreated: "product.created",
      productUpdated: "product.updated",
      pricingPriceUpdated: "pricing.price.updated",
      productDeleted: "product.deleted",
      ratingSummaryUpdated: "product.rating-summary.updated",
    },
  },
  search: {
    defaultLimit: 20,
    maxLimit: 100,
    maxSuggestions: 10,
    fuzzyFuzziness: "AUTO",
    boosting: {
      name: 4.0,
      sku: 3.5,
      brand: 2.0,
      category: 2.0,
      tags: 1.5,
      description: 1.0,
    },
  },
  monitoring: {
    serviceName: env.OTEL_SERVICE_NAME,
    logLevel: env.LOG_LEVEL,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },
} as const;
