import { v4 as uuidv4 } from "uuid";
import type {
  TaxQuoteRequest,
  TaxCalculateRequest,
  TaxCalculationResponse,
  TaxReturnQuoteRequest,
  TaxReturnQuoteResponse,
} from "@repo/types";
import { jurisdictionRepository } from "../repositories/jurisdiction.repository.js";
import { taxCategoryRepository } from "../repositories/tax-category.repository.js";
import { taxRuleRepository } from "../repositories/tax-rule.repository.js";
import { taxExemptionRepository } from "../repositories/tax-exemption.repository.js";
import { taxCalculationRepository } from "../repositories/tax-calculation.repository.js";
import { TaxProviderFactory } from "../adapters/provider-factory.js";
import type { CalculationContext } from "./calculator.js";

export class TaxService {
  /**
   * Calculate estimated tax for cart or checkout without committing authoritative order record
   */
  public async quoteTax(
    request: TaxQuoteRequest,
  ): Promise<TaxCalculationResponse> {
    const calculationId = `tax_quote_${uuidv4().replace(/-/g, "").slice(0, 16)}`;
    return this.executeTaxCalculation(request, calculationId, "quote");
  }

  /**
   * Calculate authoritative tax for an order and persist an immutable calculation snapshot
   */
  public async calculateTax(
    request: TaxCalculateRequest,
  ): Promise<TaxCalculationResponse> {
    const calculationId = `tax_calc_${uuidv4().replace(/-/g, "").slice(0, 16)}`;
    const result = await this.executeTaxCalculation(
      request,
      calculationId,
      request.referenceType || "order",
      request.referenceId,
    );

    // Save snapshot to database
    await taxCalculationRepository.saveCalculation(
      {
        id: result.calculationId,
        referenceType: result.referenceType,
        referenceId: result.referenceId,
        currency: result.currency,
        subtotal: result.subtotal,
        taxTotal: result.taxTotal,
        total: result.total,
        ruleVersion: result.ruleVersion,
        provider: result.provider,
        inputSnapshot: JSON.stringify(request),
        createdAt: new Date(),
      },
      result.lines.map((line) => ({
        id: uuidv4(),
        calculationId: result.calculationId,
        lineId: line.lineId,
        productId: request.lines.find((l) => l.lineId === line.lineId)
          ?.productId,
        categoryId: undefined,
        taxableAmount: line.taxableAmount,
        rate: line.rate,
        taxAmount: line.taxAmount,
        jurisdictionCode: line.jurisdictionCode,
        isInclusive: line.isInclusive,
        breakdown: line.breakdown ? JSON.stringify(line.breakdown) : null,
        createdAt: new Date(),
      })),
    );

    return result;
  }

  /**
   * Retrieve historical calculation snapshot by ID
   */
  public async getCalculationById(
    calculationId: string,
  ): Promise<TaxCalculationResponse | undefined> {
    return taxCalculationRepository.findById(calculationId);
  }

  /**
   * Calculate proportional tax adjustment for returned items
   */
  public async quoteReturnTax(
    request: TaxReturnQuoteRequest,
  ): Promise<TaxReturnQuoteResponse> {
    const original = await taxCalculationRepository.findById(
      request.originalCalculationId,
    );
    if (!original) {
      throw new Error(
        `Original tax calculation '${request.originalCalculationId}' not found`,
      );
    }

    const provider = TaxProviderFactory.getProvider(original.provider);
    return provider.calculateReturnTax(request, original);
  }

  /**
   * Internal execution pipeline
   */
  private async executeTaxCalculation(
    request: TaxQuoteRequest,
    calculationId: string,
    referenceType: "quote" | "order" | "invoice" | "return",
    referenceId?: string,
  ): Promise<TaxCalculationResponse> {
    const dest = request.destinationAddress;

    // 1. Resolve matching jurisdictions
    const matchingJurisdictions =
      await jurisdictionRepository.findMatchingJurisdictions(
        dest.country,
        dest.region,
        dest.city,
      );

    // 2. Resolve product categories
    const categoryCodes = Array.from(
      new Set(
        request.lines.map((l) => (l.categoryCode || "standard").toLowerCase()),
      ),
    );
    // Ensure "standard" is always present for rule fallback
    if (!categoryCodes.includes("standard")) {
      categoryCodes.push("standard");
    }

    const categories = await Promise.all(
      categoryCodes.map((c) => taxCategoryRepository.findByCode(c)),
    );
    const validCategories = categories.filter(
      (c): c is NonNullable<typeof c> => !!c,
    );

    // 3. Check for exemptions (customer exemption or exemption certificate)
    const primaryJurisdictionId = matchingJurisdictions[0]?.id;
    const exemption = await taxExemptionRepository.findActiveExemption(
      request.customerId,
      request.exemptionCertificate,
      primaryJurisdictionId,
    );

    const isExempt = !!exemption;
    const exemptionReason = exemption
      ? `Exempt via certificate ${exemption.exemptionCertificate} (${exemption.exemptionType})`
      : undefined;

    // 4. Fetch matching rules
    const jurisdictionIds = matchingJurisdictions.map((j) => j.id);
    const categoryIds = validCategories.map((c) => c.id);

    const rules = await taxRuleRepository.findActiveMatchingRules(
      jurisdictionIds,
      categoryIds,
      new Date(),
    );

    const ruleVersion = rules[0]?.version || "2026-10";

    const context: CalculationContext = {
      calculationId,
      referenceId,
      referenceType,
      rules,
      isExempt,
      exemptionReason,
      ruleVersion,
    };

    // 5. Delegate to configured provider
    const provider = TaxProviderFactory.getProvider();
    return provider.calculateTax(request, context);
  }
}

export const taxService = new TaxService();
