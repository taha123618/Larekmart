import mongoose, { InferSchemaType, model } from "mongoose";
const { Schema } = mongoose;

export const OrderStatus = ["success", "failed"] as const;

const OrderSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    taxCalculationId: { type: String, default: null },
    status: { type: String, required: true, enum: OrderStatus },
    paymentMethod: { type: String, default: "card" }, // "card" or "cod"
    isCod: { type: Boolean, default: false },
    sellerId: { type: String, default: null, index: true },
    vendorId: { type: String, default: null },
    carrier: { type: String, default: "custom" },
    trackingNumber: { type: String, default: null },
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

// Indexes covering the order-service read paths:
// - `{ userId: 1 }`              -> GET /user-orders
// - `{ createdAt: -1 }`          -> GET /orders (recent first) and the
//                                   monthly /order-chart date-range aggregation
OrderSchema.index({ createdAt: -1 });

export type OrderSchemaType = InferSchemaType<typeof OrderSchema>;

export const Order = model<OrderSchemaType>("Order", OrderSchema);
