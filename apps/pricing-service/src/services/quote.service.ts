import { db } from "../db/connection.js";
import {
  priceLists,
  productPrices,
  variantPrices,
  priceRules,
  priceQuotes,
} from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { calculateQuote } from "../engine/calculator.js";
import { convertCurrency } from "../engine/currency.js";
import { pricingService } from "./pricing.service.js";
import { pricingEventProducer } from "../kafka/producer.js";
import type {
  PriceQuoteRequest,
  BulkPriceQuoteRequest,
  PriceQuote,
  PriceRule,
} from "@repo/types";

export class QuoteService {
  /**
   * Generates an authoritative pricing quote for cart or checkout
   */
  public async generateQuote(request: PriceQuoteRequest): Promise<PriceQuote> {
    const targetCurrency = (request.currency || "USD").toUpperCase();

    // 1. Resolve active price list
    let priceList;
    if (request.priceListCode) {
      const [found] = await db
        .select()
        .from(priceLists)
        .where(
          and(
            eq(priceLists.code, request.priceListCode),
            eq(priceLists.isActive, true),
          ),
        );
      priceList = found;
    } else if (
      request.customerGroup === "b2b" ||
      request.customerGroup === "wholesale"
    ) {
      const [b2b] = await db
        .select()
        .from(priceLists)
        .where(and(eq(priceLists.type, "b2b"), eq(priceLists.isActive, true)));
      priceList = b2b;
    }

    if (!priceList) {
      const [defaultList] = await db
        .select()
        .from(priceLists)
        .where(
          and(eq(priceLists.isDefault, true), eq(priceLists.isActive, true)),
        );
      priceList = defaultList;
    }

    if (!priceList) {
      throw new Error("No active price list available for quote generation");
    }

    // 2. Fetch all active rules for this price list in a single batch query
    const allRules = await db
      .select()
      .from(priceRules)
      .where(
        and(
          eq(priceRules.priceListId, priceList.id),
          eq(priceRules.isActive, true),
        ),
      );

    // 3. Batch fetch all productPrices for requested items
    const productIds = Array.from(
      new Set(request.items.map((i) => i.productId)),
    );
    const priceRecords =
      productIds.length > 0
        ? await db
            .select()
            .from(productPrices)
            .where(
              and(
                inArray(productPrices.productId, productIds),
                eq(productPrices.priceListId, priceList.id),
                eq(productPrices.isActive, true),
              ),
            )
        : [];

    const priceRecordMap = new Map<string, (typeof priceRecords)[0]>();
    for (const p of priceRecords) {
      priceRecordMap.set(p.productId, p);
    }

    // 4. Batch fetch variant overrides for found products if applicable
    const variantMap = new Map<string, number>();
    const foundPriceIds = priceRecords.map((p) => p.id);
    const hasVariants = request.items.some((i) => i.variantId);

    if (foundPriceIds.length > 0 && hasVariants) {
      const variantRecords = await db
        .select()
        .from(variantPrices)
        .where(
          and(
            inArray(variantPrices.productPriceId, foundPriceIds),
            eq(variantPrices.isActive, true),
          ),
        );
      for (const v of variantRecords) {
        variantMap.set(`${v.productPriceId}:${v.variantId}`, Number(v.price));
      }
    }

    // 5. Prepare calculation items with base/variant prices and filtered rules
    const calculationItems = [];

    for (const item of request.items) {
      const priceRecord = priceRecordMap.get(item.productId);

      if (!priceRecord) {
        throw new Error(
          `Product ${item.productId} does not have an active price in list ${priceList.code}`,
        );
      }

      let unitBase = Number(priceRecord.basePrice);

      // Check variant price override from pre-fetched map
      if (item.variantId) {
        const variantPrice = variantMap.get(
          `${priceRecord.id}:${item.variantId}`,
        );
        if (variantPrice !== undefined) {
          unitBase = variantPrice;
        }
      }

      // Convert currency using cached exchange rates
      if (priceRecord.currency.toUpperCase() !== targetCurrency) {
        const rate = await pricingService.getExchangeRate(
          priceRecord.currency,
          targetCurrency,
        );
        unitBase = convertCurrency(
          unitBase,
          rate,
          priceRecord.currency,
          targetCurrency,
        ).convertedAmount;
      }

      const applicableRules: PriceRule[] = allRules
        .filter(
          (r) =>
            (!r.productId || r.productId === item.productId) &&
            (!r.variantId || r.variantId === item.variantId),
        )
        .map((r) => ({
          id: r.id,
          priceListId: r.priceListId,
          ruleType: r.ruleType as PriceRule["ruleType"],
          productId: r.productId,
          variantId: r.variantId,
          minQuantity: r.minQuantity,
          maxQuantity: r.maxQuantity,
          discountType: r.discountType as PriceRule["discountType"],
          discountValue: Number(r.discountValue),
          priority: r.priority,
          validFrom: r.validFrom,
          validTo: r.validTo,
          isActive: r.isActive,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));

      calculationItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        basePrice: unitBase,
        rules: applicableRules,
      });
    }

    // 4. Calculate final financial figures
    const calculation = calculateQuote({
      items: calculationItems,
      promotionDiscount: request.promotionDiscount || 0,
      currency: targetCurrency,
    });

    const quoteId = `quote_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute quote validity

    // 5. Persist immutable quote record
    const [persisted] = await db
      .insert(priceQuotes)
      .values({
        quoteId,
        currency: targetCurrency,
        items: calculation.items,
        subtotal: String(calculation.subtotal),
        totalDiscount: String(calculation.totalDiscount),
        promotionDiscount: String(calculation.promotionDiscount),
        finalTotal: String(calculation.finalTotal),
        customerGroup: request.customerGroup || null,
        expiresAt,
      })
      .returning();

    if (!persisted) {
      throw new Error("Failed to persist pricing quote");
    }

    // 6. Publish event
    await pricingEventProducer.publishQuoteCreated({
      quoteId,
      currency: targetCurrency,
      itemCount: calculation.items.length,
      subtotal: calculation.subtotal,
      finalTotal: calculation.finalTotal,
      timestamp: new Date().toISOString(),
    });

    return {
      quoteId,
      currency: targetCurrency,
      items: calculation.items,
      subtotal: calculation.subtotal,
      totalDiscount: calculation.totalDiscount,
      promotionDiscount: calculation.promotionDiscount,
      finalTotal: calculation.finalTotal,
      customerGroup: request.customerGroup || null,
      expiresAt,
      createdAt: persisted.createdAt,
    };
  }

  /**
   * Generates multiple quotes in a single batch operation
   */
  public async generateBulkQuotes(
    request: BulkPriceQuoteRequest,
  ): Promise<PriceQuote[]> {
    const results: PriceQuote[] = [];
    for (const q of request.quotes) {
      const quote = await this.generateQuote(q);
      results.push(quote);
    }
    return results;
  }
}

export const quoteService = new QuoteService();
