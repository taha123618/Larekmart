import { db } from "../db/connection.js";
import {
  priceLists,
  productPrices,
  variantPrices,
  priceRules,
  priceHistory,
  currencyRates,
} from "../db/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { pricingEventProducer } from "../kafka/producer.js";
import { convertCurrency } from "../engine/currency.js";
import type {
  CreatePriceListInput,
  UpsertProductPriceInput,
  UpdateProductPriceInput,
  PriceRule,
} from "@repo/types";

export class PricingService {
  /**
   * Retrieves active product price, variant prices, and rules with currency conversion
   */
  public async getProductPrice(
    productId: string,
    targetCurrency = "USD",
    priceListCode?: string | null,
  ) {
    // 1. Resolve price list: code if provided, otherwise default B2C list
    let priceList;
    if (priceListCode) {
      const [found] = await db
        .select()
        .from(priceLists)
        .where(
          and(
            eq(priceLists.code, priceListCode),
            eq(priceLists.isActive, true),
          ),
        );
      priceList = found;
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
      throw new Error("No active price list found");
    }

    // 2. Fetch base product price
    const [priceRecord] = await db
      .select()
      .from(productPrices)
      .where(
        and(
          eq(productPrices.productId, productId),
          eq(productPrices.priceListId, priceList.id),
          eq(productPrices.isActive, true),
        ),
      );

    if (!priceRecord) {
      return null;
    }

    // 3. Fetch variant prices
    const variants = await db
      .select()
      .from(variantPrices)
      .where(
        and(
          eq(variantPrices.productPriceId, priceRecord.id),
          eq(variantPrices.isActive, true),
        ),
      );

    // 4. Fetch applicable rules
    const rules = await db
      .select()
      .from(priceRules)
      .where(
        and(
          eq(priceRules.priceListId, priceList.id),
          eq(priceRules.isActive, true),
        ),
      );

    // Filter rules matching this product (or global rules)
    const productRules = rules.filter(
      (r) => !r.productId || r.productId === productId,
    );

    // 5. Currency conversion if target currency differs from base
    let rate = 1.0;
    if (priceRecord.currency.toUpperCase() !== targetCurrency.toUpperCase()) {
      const [rateRecord] = await db
        .select()
        .from(currencyRates)
        .where(
          and(
            eq(currencyRates.baseCurrency, priceRecord.currency.toUpperCase()),
            eq(currencyRates.targetCurrency, targetCurrency.toUpperCase()),
            eq(currencyRates.isActive, true),
          ),
        );

      if (rateRecord) {
        rate = Number(rateRecord.exchangeRate);
      }
    }

    const convertedBase = convertCurrency(
      priceRecord.basePrice,
      rate,
      priceRecord.currency,
      targetCurrency,
    );

    const convertedVariants = variants.map((v) => {
      const cv = convertCurrency(
        v.price,
        rate,
        priceRecord.currency,
        targetCurrency,
      );
      return {
        variantId: v.variantId,
        price: cv.convertedAmount,
        currency: targetCurrency,
        compareAtPrice: v.compareAtPrice
          ? convertCurrency(
              v.compareAtPrice,
              rate,
              priceRecord.currency,
              targetCurrency,
            ).convertedAmount
          : null,
        sku: v.sku,
      };
    });

    return {
      productId,
      priceListId: priceList.id,
      priceListCode: priceList.code,
      basePrice: convertedBase.convertedAmount,
      originalBasePrice: Number(priceRecord.basePrice),
      originalCurrency: priceRecord.currency,
      currency: targetCurrency,
      exchangeRate: rate,
      compareAtPrice: priceRecord.compareAtPrice
        ? convertCurrency(
            priceRecord.compareAtPrice,
            rate,
            priceRecord.currency,
            targetCurrency,
          ).convertedAmount
        : null,
      variants: convertedVariants,
      rules: productRules.map((r) => ({
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
      })),
    };
  }

  /**
   * Admin: Creates a new price list (B2C, B2B, or Seller-specific)
   */
  public async createPriceList(data: CreatePriceListInput) {
    if (data.isDefault) {
      // Unset previous default
      await db
        .update(priceLists)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(priceLists.isDefault, true));
    }

    const [created] = await db
      .insert(priceLists)
      .values({
        name: data.name,
        code: data.code,
        currency: data.currency.toUpperCase(),
        isDefault: data.isDefault,
        type: data.type,
        sellerId: data.sellerId || null,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        isActive: data.isActive,
      })
      .returning();

    return created;
  }

  /**
   * Admin: Upserts product base price
   */
  public async upsertProductPrice(
    data: UpsertProductPriceInput,
    changedBy = "admin",
  ) {
    const [existing] = await db
      .select()
      .from(productPrices)
      .where(
        and(
          eq(productPrices.priceListId, data.priceListId),
          eq(productPrices.productId, data.productId),
        ),
      );

    if (existing) {
      const oldPrice = Number(existing.basePrice);
      const newPrice = data.basePrice;

      const [updated] = await db
        .update(productPrices)
        .set({
          basePrice: String(data.basePrice),
          minPrice:
            data.minPrice !== undefined
              ? data.minPrice !== null
                ? String(data.minPrice)
                : null
              : existing.minPrice,
          maxPrice:
            data.maxPrice !== undefined
              ? data.maxPrice !== null
                ? String(data.maxPrice)
                : null
              : existing.maxPrice,
          currency: data.currency.toUpperCase(),
          compareAtPrice:
            data.compareAtPrice !== undefined
              ? data.compareAtPrice !== null
                ? String(data.compareAtPrice)
                : null
              : existing.compareAtPrice,
          costPrice:
            data.costPrice !== undefined
              ? data.costPrice !== null
                ? String(data.costPrice)
                : null
              : existing.costPrice,
          isActive: data.isActive,
          validFrom: data.validFrom
            ? new Date(data.validFrom)
            : existing.validFrom,
          validTo: data.validTo ? new Date(data.validTo) : existing.validTo,
          updatedAt: new Date(),
        })
        .where(eq(productPrices.id, existing.id))
        .returning();

      // Record audit history
      await db.insert(priceHistory).values({
        productPriceId: existing.id,
        oldPrice: String(oldPrice),
        newPrice: String(newPrice),
        currency: data.currency.toUpperCase(),
        changeReason: "Product price update",
        changedBy,
      });

      await pricingEventProducer.publishPriceUpdated({
        priceId: existing.id,
        productId: data.productId,
        oldPrice,
        newPrice,
        currency: data.currency.toUpperCase(),
        changeReason: "Product price update",
        changedBy,
        timestamp: new Date().toISOString(),
      });

      return updated;
    }

    const [created] = await db
      .insert(productPrices)
      .values({
        priceListId: data.priceListId,
        productId: data.productId,
        basePrice: String(data.basePrice),
        minPrice: data.minPrice ? String(data.minPrice) : null,
        maxPrice: data.maxPrice ? String(data.maxPrice) : null,
        currency: data.currency.toUpperCase(),
        compareAtPrice: data.compareAtPrice
          ? String(data.compareAtPrice)
          : null,
        costPrice: data.costPrice ? String(data.costPrice) : null,
        isActive: data.isActive,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create product price record");
    }

    await pricingEventProducer.publishPriceCreated({
      priceId: created.id,
      priceListId: data.priceListId,
      productId: data.productId,
      basePrice: data.basePrice,
      currency: data.currency.toUpperCase(),
      timestamp: new Date().toISOString(),
    });

    return created;
  }

  /**
   * Admin: Patches specific price record
   */
  public async patchProductPrice(
    priceId: string,
    data: UpdateProductPriceInput,
    changedBy = "admin",
  ) {
    const [existing] = await db
      .select()
      .from(productPrices)
      .where(eq(productPrices.id, priceId));

    if (!existing) {
      return null;
    }

    const oldPrice = Number(existing.basePrice);
    const newPrice = data.basePrice !== undefined ? data.basePrice : oldPrice;

    const [updated] = await db
      .update(productPrices)
      .set({
        basePrice:
          data.basePrice !== undefined
            ? String(data.basePrice)
            : existing.basePrice,
        minPrice:
          data.minPrice !== undefined
            ? data.minPrice !== null
              ? String(data.minPrice)
              : null
            : existing.minPrice,
        maxPrice:
          data.maxPrice !== undefined
            ? data.maxPrice !== null
              ? String(data.maxPrice)
              : null
            : existing.maxPrice,
        compareAtPrice:
          data.compareAtPrice !== undefined
            ? data.compareAtPrice !== null
              ? String(data.compareAtPrice)
              : null
            : existing.compareAtPrice,
        costPrice:
          data.costPrice !== undefined
            ? data.costPrice !== null
              ? String(data.costPrice)
              : null
            : existing.costPrice,
        isActive:
          data.isActive !== undefined ? data.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(productPrices.id, priceId))
      .returning();

    // Record audit history if price changed
    if (oldPrice !== newPrice) {
      await db.insert(priceHistory).values({
        productPriceId: priceId,
        oldPrice: String(oldPrice),
        newPrice: String(newPrice),
        currency: existing.currency,
        changeReason: data.changeReason || "Price adjusted via admin patch",
        changedBy,
      });

      await pricingEventProducer.publishPriceUpdated({
        priceId,
        productId: existing.productId,
        oldPrice,
        newPrice,
        currency: existing.currency,
        changeReason: data.changeReason || "Price adjusted via admin patch",
        changedBy,
        timestamp: new Date().toISOString(),
      });
    }

    return updated;
  }

  /**
   * Admin: Retrieves audit history for price modifications
   */
  public async getPriceHistory(priceId: string) {
    const history = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productPriceId, priceId))
      .orderBy(desc(priceHistory.changedAt));

    return history.map((h) => ({
      id: h.id,
      productPriceId: h.productPriceId,
      variantPriceId: h.variantPriceId,
      oldPrice: Number(h.oldPrice),
      newPrice: Number(h.newPrice),
      currency: h.currency,
      changeReason: h.changeReason,
      changedBy: h.changedBy,
      changedAt: h.changedAt,
    }));
  }

  /**
   * Retrieves all price lists
   */
  public async getPriceLists() {
    const lists = await db
      .select()
      .from(priceLists)
      .orderBy(desc(priceLists.isDefault), priceLists.name);

    return lists;
  }

  /**
   * Retrieves product prices across price lists
   */
  public async getProductPricesList(priceListId?: string) {
    let query = db
      .select({
        id: productPrices.id,
        priceListId: productPrices.priceListId,
        productId: productPrices.productId,
        basePrice: productPrices.basePrice,
        minPrice: productPrices.minPrice,
        maxPrice: productPrices.maxPrice,
        currency: productPrices.currency,
        compareAtPrice: productPrices.compareAtPrice,
        costPrice: productPrices.costPrice,
        isActive: productPrices.isActive,
        validFrom: productPrices.validFrom,
        validTo: productPrices.validTo,
        createdAt: productPrices.createdAt,
        updatedAt: productPrices.updatedAt,
        priceListName: priceLists.name,
        priceListCode: priceLists.code,
      })
      .from(productPrices)
      .leftJoin(priceLists, eq(productPrices.priceListId, priceLists.id));

    if (priceListId) {
      return await query
        .where(eq(productPrices.priceListId, priceListId))
        .orderBy(desc(productPrices.updatedAt));
    }

    return await query.orderBy(desc(productPrices.updatedAt));
  }

  /**
   * Admin: Creates a volume tier or bulk discount rule
   */
  public async createPriceRule(data: {
    priceListId: string;
    ruleType: "tier" | "bulk" | "customer_group";
    productId?: string;
    variantId?: string;
    minQuantity: number;
    maxQuantity?: number;
    discountType: "percentage" | "fixed_amount" | "override_price";
    discountValue: number;
    priority?: number;
    validFrom?: string;
    validTo?: string;
    isActive?: boolean;
  }) {
    const [created] = await db
      .insert(priceRules)
      .values({
        priceListId: data.priceListId,
        ruleType: data.ruleType,
        productId: data.productId || null,
        variantId: data.variantId || null,
        minQuantity: data.minQuantity,
        maxQuantity: data.maxQuantity ?? null,
        discountType: data.discountType,
        discountValue: String(data.discountValue),
        priority: data.priority ?? 0,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        isActive: data.isActive ?? true,
      })
      .returning();

    return created;
  }

  /**
   * Retrieves all price rules
   */
  public async getPriceRules(priceListId?: string) {
    if (priceListId) {
      return await db
        .select()
        .from(priceRules)
        .where(eq(priceRules.priceListId, priceListId))
        .orderBy(desc(priceRules.priority), desc(priceRules.createdAt));
    }

    return await db
      .select()
      .from(priceRules)
      .orderBy(desc(priceRules.priority), desc(priceRules.createdAt));
  }

  /**
   * Retrieves all active currency exchange rates
   */
  public async getCurrencyRates() {
    return await db
      .select()
      .from(currencyRates)
      .orderBy(currencyRates.baseCurrency, currencyRates.targetCurrency);
  }

  /**
   * Admin: Upserts currency exchange rate
   */
  public async upsertCurrencyRate(
    baseCurrency: string,
    targetCurrency: string,
    exchangeRate: number,
  ) {
    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    const [existing] = await db
      .select()
      .from(currencyRates)
      .where(
        and(
          eq(currencyRates.baseCurrency, base),
          eq(currencyRates.targetCurrency, target),
        ),
      );

    if (existing) {
      const [updated] = await db
        .update(currencyRates)
        .set({
          exchangeRate: String(exchangeRate),
          lastRefreshedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(currencyRates.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(currencyRates)
      .values({
        baseCurrency: base,
        targetCurrency: target,
        exchangeRate: String(exchangeRate),
        autoRefresh: true,
        isActive: true,
      })
      .returning();

    return created;
  }
}

export const pricingService = new PricingService();
