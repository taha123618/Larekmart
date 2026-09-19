import mongoose, {
  type HydratedDocument,
  InferSchemaType,
  model,
  Schema,
} from "mongoose";

export const CartStatus = [
  "active",
  "merged",
  "converted",
  "expired",
  "abandoned",
] as const;
export type CartStatusType = (typeof CartStatus)[number];

export const DiscountType = ["percentage", "fixed"] as const;
export type DiscountTypeEnum = (typeof DiscountType)[number];

export const CartItemSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    variantId: { type: String, default: null },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    size: { type: String, default: "" },
    color: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    pricingVersion: { type: Number, default: 1 },
  },
  { timestamps: true, _id: true },
);

export const CartCouponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    discountType: { type: String, required: true, enum: DiscountType },
    discountValue: { type: Number, required: true, min: 0 },
    appliedAmount: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
  },
  { timestamps: true, _id: true },
);

export const CartAdjustmentSchema = new Schema(
  {
    itemId: { type: String, required: true },
    productId: { type: String, required: true },
    reason: { type: String, required: true },
    oldQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

export const CartPricingSnapshotSchema = new Schema(
  {
    subtotal: { type: Number, required: true },
    discountTotal: { type: Number, required: true },
    taxTotal: { type: Number, required: true },
    shippingTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    currency: { type: String, default: "PKR" },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

export const CartPricingSchema = new Schema(
  {
    subtotal: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    shippingTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

export const CartSchema = new Schema(
  {
    userId: { type: String, default: null, index: true },
    guestToken: { type: String, default: null, index: true },
    status: {
      type: String,
      required: true,
      enum: CartStatus,
      default: "active",
      index: true,
    },
    currency: { type: String, default: "PKR" },
    items: { type: [CartItemSchema], default: [] },
    coupons: { type: [CartCouponSchema], default: [] },
    adjustments: { type: [CartAdjustmentSchema], default: [] },
    pricing: { type: CartPricingSchema, default: () => ({}) },
    snapshots: { type: [CartPricingSnapshotSchema], default: [] },
    version: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

// Compound indexes for fast lookups
CartSchema.index({ userId: 1, status: 1 });
CartSchema.index({ guestToken: 1, status: 1 });

export type CartItemDocType = InferSchemaType<typeof CartItemSchema>;
export type CartCouponDocType = InferSchemaType<typeof CartCouponSchema>;
export type CartAdjustmentDocType = InferSchemaType<
  typeof CartAdjustmentSchema
>;
export type CartPricingSnapshotDocType = InferSchemaType<
  typeof CartPricingSnapshotSchema
>;
export type CartSchemaType = InferSchemaType<typeof CartSchema>;
export type CartDocType = HydratedDocument<CartSchemaType>;

export const Cart = model<CartSchemaType>("Cart", CartSchema);
