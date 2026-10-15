import type {
  TaxQuoteRequest,
  TaxCalculationResponse,
  TaxReturnQuoteRequest,
  TaxReturnQuoteResponse,
} from "@repo/types";
import {
  TaxCalculator,
  type CalculationContext,
} from "../services/calculator.js";
import type { ITaxProviderAdapter } from "./tax-provider.interface.js";

/**
 * Standard Tax Engine Adapter
 * Executes jurisdiction-aware calculations locally using Drizzle MySQL rules.
 */
export class StandardTaxEngineAdapter implements ITaxProviderAdapter {
  public getProviderName(): string {
    return "standard";
  }

  public async calculateTax(
    request: TaxQuoteRequest,
    context: CalculationContext,
  ): Promise<TaxCalculationResponse> {
    return TaxCalculator.calculate(request, {
      ...context,
      provider: this.getProviderName(),
    });
  }

  public async calculateReturnTax(
    request: TaxReturnQuoteRequest,
    originalCalculation: TaxCalculationResponse,
  ): Promise<TaxReturnQuoteResponse> {
    return TaxCalculator.calculateReturnQuote(request, originalCalculation);
  }
}
