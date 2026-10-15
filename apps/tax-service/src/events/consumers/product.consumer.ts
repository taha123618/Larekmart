import { redis } from "../../utils/redis.js";

export async function handleProductTaxCategoryUpdatedEvent(
  messageValue: unknown,
): Promise<void> {
  try {
    if (!messageValue || typeof messageValue !== "object") return;
    const event = messageValue as {
      productId?: string;
      taxCategoryCode?: string;
    };
    if (event.productId && event.taxCategoryCode) {
      await redis.client.set(
        `tax:v1:product:${event.productId}:category`,
        event.taxCategoryCode,
        "EX",
        86400 * 7, // 7 days TTL
      );
      console.log(
        `[TaxService] Product tax category cached: ${event.productId} -> ${event.taxCategoryCode}`,
      );
    }
  } catch (err) {
    console.error(
      "[TaxService] Error handling product.tax-category.updated event:",
      err,
    );
  }
}

export async function handleTaxRulesUpdatedEvent(
  messageValue: unknown,
): Promise<void> {
  try {
    if (!messageValue || typeof messageValue !== "object") return;
    const event = messageValue as { version?: string; ruleIds?: string[] };
    const keys = await redis.client.keys("tax:v1:rules:*");
    if (keys.length > 0) {
      await redis.client.del(...keys);
    }
    console.log(
      `[TaxService] Tax rules cache cleared for version: ${event.version || "latest"}`,
    );
  } catch (err) {
    console.error("[TaxService] Error handling tax.rules.updated event:", err);
  }
}
