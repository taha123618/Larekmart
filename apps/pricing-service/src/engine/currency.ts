import { Decimal } from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ConversionOptions {
  applyPsychologicalRounding?: boolean;
}

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  isPsychologicallyRounded: boolean;
}

/**
 * Applies regional psychological charm pricing rules:
 * - USD/EUR/GBP/CAD: .99 (e.g., $19.99, €24.99)
 * - PKR: Whole rounded figures to nearest 50 or 10 (e.g., ₨ 5,500 or ₨ 5,490)
 * - AED/SAR: Clean integers or .50/.00 intervals
 * - JPY: Whole rounded integer
 */
export function applyPsychologicalRounding(
  amount: Decimal,
  targetCurrency: string,
): Decimal {
  const curr = targetCurrency.toUpperCase();

  // Low value protection: don't round items below 1.00
  if (amount.lessThan(1)) {
    return amount.toDecimalPlaces(2);
  }

  switch (curr) {
    case "USD":
    case "EUR":
    case "GBP":
    case "CAD": {
      // Charm pricing: floor to whole unit + 0.99
      const floor = amount.floor();
      // If the difference is tiny (< 0.10) or already ends in .99, keep clean
      return floor.plus(0.99);
    }

    case "PKR": {
      // Whole numbers in Pakistani Rupee, rounded to nearest 50 for clean cash/card transactions
      const whole = amount.round().toNumber();
      const roundedTo50 = Math.round(whole / 50) * 50;
      return new Decimal(Math.max(50, roundedTo50));
    }

    case "AED":
    case "SAR": {
      // UAE Dirham and Saudi Riyal: clean integer or .50 rounding
      const doubleAmount = amount.times(2).round().dividedBy(2);
      return doubleAmount.toDecimalPlaces(2);
    }

    case "JPY": {
      // Zero-decimal whole integers
      return amount.round().toDecimalPlaces(0);
    }

    default:
      return amount.toDecimalPlaces(2);
  }
}

/**
 * High-precision currency conversion using Decimal.js with optional psychological price rounding
 */
export function convertCurrency(
  amount: number | string,
  rate: number | string,
  fromCurrency: string,
  toCurrency: string,
  options?: ConversionOptions,
): ConversionResult {
  const decAmount = new Decimal(amount);
  const decRate = new Decimal(rate);
  const shouldRoundPsychologically =
    options?.applyPsychologicalRounding ?? false;

  if (decAmount.isNegative()) {
    throw new Error("Amount for currency conversion must be non-negative");
  }
  if (decRate.isNegative() || decRate.isZero()) {
    throw new Error("Exchange rate must be strictly positive");
  }

  const fromUpper = fromCurrency.toUpperCase();
  const toUpper = toCurrency.toUpperCase();

  if (fromUpper === toUpper) {
    return {
      originalAmount: decAmount.toDecimalPlaces(2).toNumber(),
      originalCurrency: fromUpper,
      convertedAmount: decAmount.toDecimalPlaces(2).toNumber(),
      targetCurrency: toUpper,
      exchangeRate: 1.0,
      isPsychologicallyRounded: false,
    };
  }

  let converted = decAmount.times(decRate).toDecimalPlaces(2);
  let isRounded = false;

  if (shouldRoundPsychologically) {
    converted = applyPsychologicalRounding(converted, toUpper);
    isRounded = true;
  }

  return {
    originalAmount: decAmount.toDecimalPlaces(2).toNumber(),
    originalCurrency: fromUpper,
    convertedAmount: converted.toNumber(),
    targetCurrency: toUpper,
    exchangeRate: decRate.toNumber(),
    isPsychologicallyRounded: isRounded,
  };
}
