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
  convertPrice: (usdAmount: number) => number;
  formatPrice: (usdAmount: number) => string;
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

      convertPrice: (usdAmount: number): number => {
        const { currentCurrency, exchangeRates } = get();
        const rate = exchangeRates[currentCurrency] ?? 1.0;
        return usdAmount * rate;
      },

      formatPrice: (usdAmount: number): string => {
        const { currentCurrency, exchangeRates } = get();
        const config =
          SUPPORTED_CURRENCIES[currentCurrency] ?? SUPPORTED_CURRENCIES["USD"]!;
        const rate = exchangeRates[currentCurrency] ?? 1.0;
        const converted = usdAmount * rate;

        const formattedNumber = converted.toLocaleString(undefined, {
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
