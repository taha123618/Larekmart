import { Decimal } from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
}

/**
 * High-precision currency conversion using Decimal.js
 */
export function convertCurrency(
  amount: number | string,
  rate: number | string,
  fromCurrency: string,
  toCurrency: string,
): ConversionResult {
  const decAmount = new Decimal(amount);
  const decRate = new Decimal(rate);

  if (decAmount.isNegative()) {
    throw new Error("Amount for currency conversion must be non-negative");
  }
  if (decRate.isNegative() || decRate.isZero()) {
    throw new Error("Exchange rate must be strictly positive");
  }

  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return {
      originalAmount: decAmount.toDecimalPlaces(2).toNumber(),
      originalCurrency: fromCurrency.toUpperCase(),
      convertedAmount: decAmount.toDecimalPlaces(2).toNumber(),
      targetCurrency: toCurrency.toUpperCase(),
      exchangeRate: 1.0,
    };
  }

  const converted = decAmount.times(decRate).toDecimalPlaces(2);

  return {
    originalAmount: decAmount.toDecimalPlaces(2).toNumber(),
    originalCurrency: fromCurrency.toUpperCase(),
    convertedAmount: converted.toNumber(),
    targetCurrency: toCurrency.toUpperCase(),
    exchangeRate: decRate.toNumber(),
  };
}
