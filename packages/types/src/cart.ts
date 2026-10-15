import type { Product } from "@repo/product-db";
import z from "zod";

export type CartItemType = Product & {
  quantity: number;
  selectedSize: string;
  selectedColor: string;
};

export type CartItemsType = CartItemType[];

export const shippingFormSchema = z.object({
  name: z.string().min(1, "Name is required!"),
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")
    .min(1, "Email is required!"),
  phone: z
    .string()
    .min(7, "Phone number must be at least 7 digits!")
    .max(15, "Phone number cannot exceed 15 digits!"),
  address: z.string().min(1, "Address is required!"),
  city: z.string().min(1, "City is required!"),
  carrier: z.string().optional(),
  serviceType: z.string().optional(),
  shippingAmount: z.number().optional(),
  isCod: z.boolean().optional(),
  codAmount: z.number().optional(),
  codFee: z.number().optional(),
});

export type ShippingFormInputs = z.infer<typeof shippingFormSchema>;

export type CartStoreStateType = {
  cart: CartItemsType;
  hasHydrated: boolean;
};

export type CartStoreActionsType = {
  addToCart: (product: CartItemType, authToken?: string) => void;
  removeFromCart: (product: CartItemType, authToken?: string) => void;
  clearCart: (authToken?: string) => void;
};

// ==========================================
// Cart Microservice Schemas & Types
// ==========================================

export const AddToCartSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional().nullable(),
  quantity: z
    .number()
    .int()
    .positive("Quantity must be greater than 0")
    .default(1),
  name: z.string().optional(),
  image: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AddToCartInputType = z.infer<typeof AddToCartSchema>;

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  size: z.string().optional(),
  color: z.string().optional(),
});
export type UpdateCartItemInputType = z.infer<typeof UpdateCartItemSchema>;

export const MergeCartSchema = z.object({
  guestToken: z.string().min(1, "Guest token is required to merge cart"),
});
export type MergeCartInputType = z.infer<typeof MergeCartSchema>;

export const ApplyCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").toUpperCase().trim(),
});
export type ApplyCouponInputType = z.infer<typeof ApplyCouponSchema>;

export const CartServiceItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  name: z.string(),
  image: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  subtotal: z.number().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  pricingVersion: z.number().int().default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type CartServiceItemType = z.infer<typeof CartServiceItemSchema>;

export const CartCouponItemSchema = z.object({
  id: z.string().optional(),
  code: z.string(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().nonnegative(),
  appliedAmount: z.number().nonnegative(),
  minOrderAmount: z.number().nonnegative().optional(),
});
export type CartCouponItemType = z.infer<typeof CartCouponItemSchema>;

export const CartAdjustmentItemSchema = z.object({
  id: z.string().optional(),
  itemId: z.string(),
  productId: z.string(),
  reason: z.string(),
  oldQuantity: z.number(),
  newQuantity: z.number(),
  createdAt: z.string().optional(),
});
export type CartAdjustmentItemType = z.infer<typeof CartAdjustmentItemSchema>;

export const CartTotalsSchema = z.object({
  subtotal: z.number().nonnegative().default(0),
  discountTotal: z.number().nonnegative().default(0),
  taxTotal: z.number().nonnegative().default(0),
  shippingTotal: z.number().nonnegative().default(0),
  grandTotal: z.number().nonnegative().default(0),
});
export type CartTotalsType = z.infer<typeof CartTotalsSchema>;

export const CartResponseSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  guestToken: z.string().nullable().optional(),
  status: z.enum(["active", "merged", "converted", "expired", "abandoned"]),
  currency: z.string().default("PKR"),
  items: z.array(CartServiceItemSchema),
  coupons: z.array(CartCouponItemSchema).default([]),
  adjustments: z.array(CartAdjustmentItemSchema).default([]),
  pricing: CartTotalsSchema,
  version: z.number().int().default(1),
  expiresAt: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type CartResponseType = z.infer<typeof CartResponseSchema>;

export const CartSummarySchema = z.object({
  id: z.string(),
  totalItems: z.number().int().nonnegative(),
  grandTotal: z.number().nonnegative(),
  currency: z.string(),
  expiresAt: z.string(),
});
export type CartSummaryType = z.infer<typeof CartSummarySchema>;

export const CartEventTypeSchema = z.enum([
  "cart.created",
  "cart.item_added",
  "cart.item_updated",
  "cart.item_removed",
  "cart.merged",
  "cart.coupon_added",
  "cart.coupon_removed",
  "cart.expired",
  "cart.cleared",
]);
export type CartEventName = z.infer<typeof CartEventTypeSchema>;

export const CartEventPayloadSchema = z.object({
  eventId: z.string(),
  eventType: CartEventTypeSchema,
  cartId: z.string(),
  userId: z.string().nullable().optional(),
  guestToken: z.string().nullable().optional(),
  productId: z.string().optional(),
  variantId: z.string().optional().nullable(),
  quantity: z.number().optional(),
  couponCode: z.string().optional(),
  timestamp: z.string(),
});
export type CartEventPayloadType = z.infer<typeof CartEventPayloadSchema>;

export const CreateCheckoutSessionSchema = z.object({
  cart: z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(250),
        quantity: z.number().int().positive().max(100),
        price: z.number().nonnegative().optional(),
      }),
    )
    .min(1, "Cart must contain at least one item"),
  cartId: z.string().max(100).optional(),
  reservationId: z.string().max(100).optional(),
  couponCode: z.string().max(50).optional(),
  discountAmount: z.number().nonnegative().optional(),
});
export type CreateCheckoutSessionInputType = z.infer<
  typeof CreateCheckoutSessionSchema
>;
