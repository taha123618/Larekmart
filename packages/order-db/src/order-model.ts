import mongoose, { InferSchemaType, model } from "mongoose";
const { Schema } = mongoose;

export const OrderStatus = [
  "success",
  "failed",
  "pending_confirmation",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled_out_of_stock",
  "cancelled_tax_mismatch",
  "refund_pending",
  "refunded",
] as const;

const OrderSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    taxCalculationId: { type: String, default: null },
    taxStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "voided"],
      default: "pending",
    },
    inventoryStatus: {
      type: String,
      enum: ["pending", "reserved", "sold", "failed"],
      default: "pending",
    },
    status: {
      type: String,
      required: true,
      enum: OrderStatus,
      default: "pending_confirmation",
    },
    paymentMethod: { type: String, default: "card" }, // "card" or "cod"
    isCod: { type: Boolean, default: false },
    sellerId: { type: String, default: null, index: true },
    vendorId: { type: String, default: null },
    carrier: { type: String, default: "custom" },
    trackingNumber: { type: String, default: null },
    paymentSessionId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    reservationId: { type: String, default: null },
    refundId: { type: String, default: null },
    sagaHistory: {
      type: [
        {
          state: { type: String, required: true },
          trigger: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
          error: { type: String, default: null },
        },
      ],
      default: [],
    },
    shippingAddress: {
      type: {
        fullName: String,
        phone: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
      default: null,
    },
    products: {
      type: [
        {
          name: { type: String, required: true },
          quantity: { type: Number, required: true },
          price: { type: Number, required: true },
          sellerId: { type: String, default: null },
        },
      ],
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes covering the order-service read and horizontal sharding paths:
// - `{ userId: 1 }`              -> GET /user-orders single-user equality lookup
// - `{ createdAt: -1 }`          -> GET /orders (recent first) and monthly /order-chart date-range aggregation
// - `{ userId: "hashed" }`       -> MongoDB horizontal sharding key (distributes write I/O across cluster shards)
// - `{ userId: 1, createdAt: -1 }` -> Compound index covering user order history sorted by time
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ userId: "hashed" });
OrderSchema.index({ userId: 1, createdAt: -1 });

export type OrderSchemaType = InferSchemaType<typeof OrderSchema>;

export const Order = model<OrderSchemaType>("Order", OrderSchema);
