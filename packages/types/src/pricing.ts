import { z } from "zod";

// ==============================================================================
// 1. Core Domain Interfaces & Enums
// ==============================================================================

export type PriceListType = "b2c" | "b2b";
export type PriceRuleType = "tier" | "bulk" | "customer_group";
export type DiscountCalculationType =
  | "percentage"
  | "fixed_amount"
  | "override_price";

export interface PriceList {
  id: string;
  name: string;
  code: string;
  currency: string;
  isDefault: boolean;
  type: PriceListType;
  sellerId?: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductPrice {
  id: string;
  priceListId: string;
  productId: string;
  basePrice: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  currency: string;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  isActive: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantPrice {
  id: string;
  productPriceId: string;
  variantId: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  sku?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceRule {
  id: string;
  priceListId: string;
  ruleType: PriceRuleType;
  productId?: string | null;
  variantId?: string | null;
  minQuantity: number;
  maxQuantity?: number | null;
  discountType: DiscountCalculationType;
  discountValue: number;
  priority: number;
  validFrom?: Date | null;
  validTo?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceHistory {
  id: string;
  productPriceId: string;
  variantPriceId?: string | null;
  oldPrice: number;
  newPrice: number;
  currency: string;
  changeReason: string;
  changedBy: string;
  changedAt: Date;
}

export interface PriceQuoteItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface PriceQuoteItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitBasePrice: number;
  unitTierPrice: number;
  unitDiscount: number;
  unitFinalPrice: number;
  lineTotal: number;
  appliedRuleId?: string | null;
}

export interface PriceQuote {
  quoteId: string;
  currency: string;
  items: PriceQuoteItem[];
  subtotal: number;
  totalDiscount: number;
  promotionDiscount: number;
  finalTotal: number;
  customerGroup?: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface CurrencyRate {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  autoRefresh: boolean;
  lastRefreshedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==============================================================================
// 2. Zod Validation Schemas
// ==============================================================================

export const PriceListTypeEnum = z.enum(["b2c", "b2b"]);
export const PriceRuleTypeEnum = z.enum(["tier", "bulk", "customer_group"]);
export const DiscountCalculationTypeEnum = z.enum([
  "percentage",
  "fixed_amount",
  "override_price",
]);

export const CreatePriceListSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().min(1, "Code is required").max(64),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .default("USD"),
  isDefault: z.boolean().default(false),
  type: PriceListTypeEnum.default("b2c"),
  sellerId: z.string().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreatePriceListInput = z.infer<typeof CreatePriceListSchema>;

export const UpdatePriceListSchema = CreatePriceListSchema.partial();
export type UpdatePriceListInput = z.infer<typeof UpdatePriceListSchema>;

export const UpsertProductPriceSchema = z.object({
  priceListId: z.string().uuid("Invalid price list UUID"),
  productId: z.string().min(1, "Product ID is required"),
  basePrice: z.number().nonnegative("Base price must be non-negative"),
  minPrice: z.number().nonnegative().optional().nullable(),
  maxPrice: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("USD"),
  compareAtPrice: z.number().nonnegative().optional().nullable(),
  costPrice: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
});
export type UpsertProductPriceInput = z.infer<typeof UpsertProductPriceSchema>;

export const UpdateProductPriceSchema = z.object({
  basePrice: z.number().nonnegative().optional(),
  minPrice: z.number().nonnegative().optional().nullable(),
  maxPrice: z.number().nonnegative().optional().nullable(),
  compareAtPrice: z.number().nonnegative().optional().nullable(),
  costPrice: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  changeReason: z
    .string()
    .min(1, "Change reason is required")
    .default("Price adjustment"),
});
export type UpdateProductPriceInput = z.infer<typeof UpdateProductPriceSchema>;

export const UpsertVariantPriceSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  price: z.number().nonnegative("Variant price must be non-negative"),
  compareAtPrice: z.number().nonnegative().optional().nullable(),
  costPrice: z.number().nonnegative().optional().nullable(),
  sku: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type UpsertVariantPriceInput = z.infer<typeof UpsertVariantPriceSchema>;

export const CreatePriceRuleSchema = z.object({
  priceListId: z.string().uuid(),
  ruleType: PriceRuleTypeEnum,
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  minQuantity: z.number().int().positive().default(1),
  maxQuantity: z.number().int().positive().optional().nullable(),
  discountType: DiscountCalculationTypeEnum,
  discountValue: z.number().nonnegative(),
  priority: z.number().int().default(0),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreatePriceRuleInput = z.infer<typeof CreatePriceRuleSchema>;

export const PriceQuoteItemRequestSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

export const PriceQuoteRequestSchema = z.object({
  items: z
    .array(PriceQuoteItemRequestSchema)
    .min(1, "At least one item is required"),
  currency: z.string().length(3).default("USD"),
  customerGroup: z.string().optional().nullable(),
  priceListCode: z.string().optional().nullable(),
  promotionDiscount: z.number().nonnegative().default(0),
});
export type PriceQuoteRequest = z.infer<typeof PriceQuoteRequestSchema>;

export const BulkPriceQuoteRequestSchema = z.object({
  quotes: z.array(PriceQuoteRequestSchema).min(1),
});
export type BulkPriceQuoteRequest = z.infer<typeof BulkPriceQuoteRequestSchema>;

export const CurrencyRateSchema = z.object({
  baseCurrency: z.string().length(3),
  targetCurrency: z.string().length(3),
  exchangeRate: z.number().positive("Exchange rate must be positive"),
  autoRefresh: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export type CurrencyRateInput = z.infer<typeof CurrencyRateSchema>;

// ==============================================================================
// 3. Kafka Event Payload Types & Topics
// ==============================================================================

export interface PriceCreatedEventPayload {
  priceId: string;
  priceListId: string;
  productId: string;
  variantId?: string | null;
  basePrice: number;
  currency: string;
  timestamp: string;
}

export interface PriceUpdatedEventPayload {
  priceId: string;
  productId: string;
  variantId?: string | null;
  oldPrice: number;
  newPrice: number;
  currency: string;
  changeReason: string;
  changedBy: string;
  timestamp: string;
}

export interface PriceExpiredEventPayload {
  priceId: string;
  productId: string;
  priceListId: string;
  timestamp: string;
}

export interface QuoteCreatedEventPayload {
  quoteId: string;
  currency: string;
  itemCount: number;
  subtotal: number;
  finalTotal: number;
  timestamp: string;
}
