import Decimal from "decimal.js";
import type {
  TaxQuoteRequest,
  TaxCalculationResponse,
  TaxCalculationLineOutput,
  TaxLineJurisdictionBreakdown,
  TaxReturnQuoteRequest,
  TaxReturnQuoteResponse,
} from "@repo/types";

// Configure Decimal.js precision and standard financial rounding (ROUND_HALF_UP)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface MatchedTaxRule {
  id: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  jurisdictionType: "country" | "region" | "municipality" | "special";
  categoryCode: string;
  rate: string; // e.g. "0.060000"
  isInclusive: boolean;
  priority: number;
  version: string;
}

export interface CalculationContext {
  calculationId: string;
  referenceId?: string;
  referenceType?: "quote" | "order" | "invoice" | "return";
  rules: MatchedTaxRule[];
  isExempt?: boolean;
  exemptionReason?: string;
  ruleVersion?: string;
  provider?: string;
}

/**
 * Jurisdiction-aware Decimal Tax Calculator Engine
 * Guarantees zero JavaScript floating-point errors.
 */
export class TaxCalculator {
  /**
   * Calculate taxes for an order or quote request using resolved rules
   */
  public static calculate(
    request: TaxQuoteRequest,
    context: CalculationContext,
  ): TaxCalculationResponse {
    let subtotalDecimal = new Decimal(0);
    let taxTotalDecimal = new Decimal(0);
    let totalDecimal = new Decimal(0);

    const isExempt = !!context.isExempt;
    const ruleVersion = context.ruleVersion || "2026-10";
    const provider = context.provider || "standard";

    const linesOutput: TaxCalculationLineOutput[] = request.lines.map(
      (line) => {
        const lineAmount = new Decimal(line.amount || "0");
        const discountAmount = new Decimal(line.discountAmount || "0");
        const effectiveBase = Decimal.max(0, lineAmount.minus(discountAmount));

        const isLineInclusive =
          line.isInclusive ?? request.isInclusive ?? false;

        if (isExempt) {
          subtotalDecimal = subtotalDecimal.plus(effectiveBase);
          totalDecimal = totalDecimal.plus(effectiveBase);

          return {
            lineId: line.lineId,
            taxableAmount: effectiveBase.toFixed(2),
            taxAmount: "0.00",
            rate: "0.000000",
            jurisdictionCode: request.destinationAddress.region
              ? `${request.destinationAddress.country}-${request.destinationAddress.region}`
              : request.destinationAddress.country,
            isInclusive: isLineInclusive,
            breakdown: [],
          };
        }

        // Filter rules matching product category or fallback to standard
        const matchingRules = context.rules.filter(
          (r) =>
            r.categoryCode.toLowerCase() === line.categoryCode.toLowerCase() ||
            r.categoryCode.toLowerCase() === "standard",
        );

        // Aggregate rate from matching jurisdictions
        let combinedRate = new Decimal(0);
        const breakdown: TaxLineJurisdictionBreakdown[] = [];

        // Sort rules by priority
        const sortedRules = [...matchingRules].sort(
          (a, b) => b.priority - a.priority,
        );

        // Deduplicate by jurisdictionType (highest priority wins per jurisdiction type)
        const seenTypes = new Set<string>();
        const applicableRules: MatchedTaxRule[] = [];
        for (const r of sortedRules) {
          const key = `${r.jurisdictionType}:${r.jurisdictionCode}`;
          if (!seenTypes.has(key)) {
            seenTypes.add(key);
            applicableRules.push(r);
            combinedRate = combinedRate.plus(new Decimal(r.rate));
          }
        }

        let lineTaxableAmount: Decimal;
        let lineTaxAmount: Decimal;

        if (isLineInclusive) {
          // Inclusive Tax: gross = net + tax => tax = gross - (gross / (1 + rate))
          if (combinedRate.isZero()) {
            lineTaxAmount = new Decimal(0);
            lineTaxableAmount = effectiveBase;
          } else {
            const denominator = new Decimal(1).plus(combinedRate);
            lineTaxableAmount = effectiveBase
              .dividedBy(denominator)
              .toDecimalPlaces(2);
            lineTaxAmount = effectiveBase
              .minus(lineTaxableAmount)
              .toDecimalPlaces(2);
          }
        } else {
          // Exclusive Tax: tax = net * rate, total = net + tax
          lineTaxableAmount = effectiveBase.toDecimalPlaces(2);
          lineTaxAmount = lineTaxableAmount
            .times(combinedRate)
            .toDecimalPlaces(2);
        }

        // Calculate component breakdown proportionally
        for (const rule of applicableRules) {
          const ruleRate = new Decimal(rule.rate);
          let componentTax: Decimal;
          if (combinedRate.isZero()) {
            componentTax = new Decimal(0);
          } else {
            // Component tax = (ruleRate / combinedRate) * lineTaxAmount
            componentTax = lineTaxAmount
              .times(ruleRate.dividedBy(combinedRate))
              .toDecimalPlaces(2);
          }

          breakdown.push({
            jurisdictionCode: rule.jurisdictionCode,
            jurisdictionName: rule.jurisdictionName,
            jurisdictionType: rule.jurisdictionType,
            rate: ruleRate.toFixed(6),
            taxAmount: componentTax.toFixed(2),
          });
        }

        subtotalDecimal = subtotalDecimal.plus(lineTaxableAmount);
        taxTotalDecimal = taxTotalDecimal.plus(lineTaxAmount);

        const primaryJurisdictionCode =
          applicableRules[0]?.jurisdictionCode ||
          (request.destinationAddress.region
            ? `${request.destinationAddress.country}-${request.destinationAddress.region}`
            : request.destinationAddress.country);

        return {
          lineId: line.lineId,
          taxableAmount: lineTaxableAmount.toFixed(2),
          taxAmount: lineTaxAmount.toFixed(2),
          rate: combinedRate.toFixed(6),
          jurisdictionCode: primaryJurisdictionCode,
          isInclusive: isLineInclusive,
          breakdown,
        };
      },
    );

    totalDecimal = subtotalDecimal.plus(taxTotalDecimal);

    return {
      calculationId: context.calculationId,
      referenceId: context.referenceId,
      referenceType: context.referenceType || "quote",
      currency: request.currency.toUpperCase(),
      subtotal: subtotalDecimal.toFixed(2),
      taxTotal: taxTotalDecimal.toFixed(2),
      total: totalDecimal.toFixed(2),
      lines: linesOutput,
      ruleVersion,
      provider,
      isExempt,
      exemptionReason: context.exemptionReason,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate proportional tax adjustments for returns and refunds
   */
  public static calculateReturnQuote(
    request: TaxReturnQuoteRequest,
    originalCalculation: TaxCalculationResponse,
  ): TaxReturnQuoteResponse {
    let subtotalRefund = new Decimal(0);
    let taxRefundTotal = new Decimal(0);

    const originalLinesMap = new Map(
      originalCalculation.lines.map((l) => [l.lineId, l]),
    );

    const returnLines = request.returnedLines.map((retLine) => {
      const orig = originalLinesMap.get(retLine.lineId);
      const retAmount = new Decimal(retLine.returnAmount);
      subtotalRefund = subtotalRefund.plus(retAmount);

      let lineTaxRefund = new Decimal(0);
      let adjustedRate = "0.000000";

      if (orig) {
        const origTaxable = new Decimal(orig.taxableAmount);
        const origTax = new Decimal(orig.taxAmount);
        adjustedRate = orig.rate;

        if (!origTaxable.isZero() && !origTax.isZero()) {
          // Proportional tax refund = returnAmount * (originalTax / originalTaxable)
          lineTaxRefund = retAmount
            .times(origTax.dividedBy(origTaxable))
            .toDecimalPlaces(2);
        }
      }

      taxRefundTotal = taxRefundTotal.plus(lineTaxRefund);

      return {
        lineId: retLine.lineId,
        returnedAmount: retAmount.toFixed(2),
        taxRefundAmount: lineTaxRefund.toFixed(2),
        adjustedRate,
      };
    });

    const totalRefund = subtotalRefund.plus(taxRefundTotal);

    return {
      returnCalculationId: `ret_tax_${Date.now()}`,
      originalCalculationId: originalCalculation.calculationId,
      currency: originalCalculation.currency,
      subtotalRefund: subtotalRefund.toFixed(2),
      taxRefundTotal: taxRefundTotal.toFixed(2),
      totalRefund: totalRefund.toFixed(2),
      lines: returnLines,
      ruleVersion: originalCalculation.ruleVersion,
      adjustedAt: new Date().toISOString(),
    };
  }
}
