import type {
  TaxQuoteRequest,
  TaxCalculationResponse,
  TaxReturnQuoteRequest,
  TaxReturnQuoteResponse,
} from "@repo/types";
import type { CalculationContext } from "../services/calculator.js";

/**
 * Pluggable Tax Provider Adapter Interface
 * Enables switching between standard internal rule engine and external providers (e.g. TaxJar / Avalara).
 */
export interface ITaxProviderAdapter {
  getProviderName(): string;

  calculateTax(
    request: TaxQuoteRequest,
    context: CalculationContext,
  ): Promise<TaxCalculationResponse>;

  calculateReturnTax(
    request: TaxReturnQuoteRequest,
    originalCalculation: TaxCalculationResponse,
  ): Promise<TaxReturnQuoteResponse>;
}
