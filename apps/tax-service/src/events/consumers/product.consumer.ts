export async function handleProductTaxCategoryUpdatedEvent(
  messageValue: unknown,
): Promise<void> {
  try {
    if (!messageValue || typeof messageValue !== "object") return;
    const event = messageValue as {
      productId?: string;
      taxCategoryCode?: string;
    };
    console.log(
      `[TaxService] Product tax category updated for product: ${event.productId} -> category: ${event.taxCategoryCode}`,
    );
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
    console.log(
      `[TaxService] Tax rules updated notification received for version: ${event.version}`,
    );
  } catch (err) {
    console.error("[TaxService] Error handling tax.rules.updated event:", err);
  }
}
