import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchCurrencyRates } from "@/services/pricing.service";

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", decimals: 2 },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    flag: "🇬🇧",
    decimals: 2,
  },
  PKR: {
    code: "PKR",
    symbol: "₨",
    name: "Pakistani Rupee",
    flag: "🇵🇰",
    decimals: 0,
  },
  CAD: {
    code: "CAD",
    symbol: "CA$",
    name: "Canadian Dollar",
    flag: "🇨🇦",
    decimals: 2,
  },
  AED: {
    code: "AED",
    symbol: "AED ",
    name: "UAE Dirham",
    flag: "🇦🇪",
    decimals: 2,
  },
  CNY: {
    code: "CNY",
    symbol: "¥",
    name: "Chinese Yuan",
    flag: "🇨🇳",
    decimals: 2,
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    flag: "🇯🇵",
    decimals: 0,
  },
  SAR: {
    code: "SAR",
    symbol: "SAR ",
    name: "Saudi Riyal",
    flag: "🇸🇦",
    decimals: 2,
  },
};

const DEFAULT_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  PKR: 278.5,
  CAD: 1.36,
  AED: 3.67,
  CNY: 7.23,
  JPY: 155.0,
  SAR: 3.75,
};

interface CurrencyState {
  currentCurrency: string;
  exchangeRates: Record<string, number>;
  isLoadingRates: boolean;
  setCurrency: (currency: string) => void;
  loadRates: () => Promise<void>;
  convertPrice: (usdAmount: number, applyRounding?: boolean) => number;
  formatPrice: (usdAmount: number) => string;
}

export function applyStorefrontPsychologicalRounding(
  amount: number,
  currency: string,
): number {
  if (amount <= 1) return Math.round(amount * 100) / 100;
  const curr = currency.toUpperCase();

  switch (curr) {
    case "USD":
    case "EUR":
    case "GBP":
    case "CAD": {
      // Psychological charm pricing ending in .99
      return Math.floor(amount) + 0.99;
    }
    case "PKR": {
      // Rounded to nearest 50 for realistic retail figures in Pakistan
      const rounded = Math.round(amount / 50) * 50;
      return Math.max(50, rounded);
    }
    case "AED":
    case "SAR": {
      // Rounded to .00 or .50
      return Math.round(amount * 2) / 2;
    }
    case "JPY": {
      return Math.round(amount);
    }
    default:
      return Math.round(amount * 100) / 100;
  }
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currentCurrency: "USD",
      exchangeRates: DEFAULT_RATES,
      isLoadingRates: false,

      setCurrency: (currency: string) => {
        if (SUPPORTED_CURRENCIES[currency]) {
          set({ currentCurrency: currency });
        }
      },

      loadRates: async () => {
        set({ isLoadingRates: true });
        try {
          const rates = await fetchCurrencyRates();
          if (rates && rates.length > 0) {
            const mapped: Record<string, number> = { USD: 1.0 };
            for (const r of rates) {
              if (r.baseCurrency === "USD" && r.isActive) {
                mapped[r.targetCurrency] = Number(r.exchangeRate);
              }
            }
            set({ exchangeRates: { ...DEFAULT_RATES, ...mapped } });
          }
        } catch (err) {
          console.warn(
            "[useCurrencyStore] Failed to fetch live exchange rates:",
            err,
          );
        } finally {
          set({ isLoadingRates: false });
        }
      },

      convertPrice: (usdAmount: number, applyRounding = true): number => {
        const { currentCurrency, exchangeRates } = get();
        const rate = exchangeRates[currentCurrency] ?? 1.0;
        const converted = usdAmount * rate;
        return applyRounding
          ? applyStorefrontPsychologicalRounding(converted, currentCurrency)
          : Math.round(converted * 100) / 100;
      },

      formatPrice: (usdAmount: number): string => {
        const { currentCurrency, exchangeRates } = get();
        const config =
          SUPPORTED_CURRENCIES[currentCurrency] ?? SUPPORTED_CURRENCIES["USD"]!;
        const rate = exchangeRates[currentCurrency] ?? 1.0;
        const converted = usdAmount * rate;
        const rounded = applyStorefrontPsychologicalRounding(
          converted,
          currentCurrency,
        );

        const formattedNumber = rounded.toLocaleString(undefined, {
          minimumFractionDigits: config.decimals,
          maximumFractionDigits: config.decimals,
        });

        return `${config.symbol}${formattedNumber}`;
      },
    }),
    {
      name: "larekmart_currency_preference",
      partialize: (state) => ({ currentCurrency: state.currentCurrency }),
    },
  ),
);
