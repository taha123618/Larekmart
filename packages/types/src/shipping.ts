import { z } from "zod";

// ==========================================
// 1. Shipment Status State Machine
// ==========================================
export const ShipmentStatusEnum = [
  "PENDING",
  "LABEL_CREATED",
  "READY_TO_SHIP",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
  "RETURNED",
  "LOST",
] as const;

export type ShipmentStatus = (typeof ShipmentStatusEnum)[number];

export const ShipmentStatusSchema = z.enum(ShipmentStatusEnum);

// ==========================================
// 2. Shipping Address Snapshot
// ==========================================
export const ShippingAddressSnapshotSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional().nullable(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(2, "Country code is required").default("PK"),
});

export type ShippingAddressSnapshot = z.infer<
  typeof ShippingAddressSnapshotSchema
>;

// ==========================================
// 3. Shipping Rates & Methods
// ==========================================
export const ShippingRateItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  weight: z.number().positive().optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
});

export type ShippingRateItem = z.infer<typeof ShippingRateItemSchema>;

export const ShippingRateRequestSchema = z.object({
  country: z.string().default("PK"),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  items: z.array(ShippingRateItemSchema).optional().default([]),
  isCod: z.boolean().optional().default(false),
  codAmount: z.number().nonnegative().optional().nullable(),
});

export type ShippingRateRequest = z.input<typeof ShippingRateRequestSchema>;

export const ShippingRateSchema = z.object({
  id: z.string(),
  carrier: z.string(),
  service: z.string(),
  name: z.string(),
  amount: z.number().nonnegative(),
  currency: z.string().default("PKR"),
  estimatedDaysMin: z.number().int().nonnegative().optional(),
  estimatedDaysMax: z.number().int().nonnegative().optional(),
  isCodAvailable: z.boolean().optional().default(false),
  codFee: z.number().nonnegative().optional().nullable(),
});

export type ShippingRate = z.infer<typeof ShippingRateSchema>;

export const ShippingMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  carrier: z.string(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  baseRate: z.number().nonnegative(),
  estimatedDaysMin: z.number().int().nonnegative(),
  estimatedDaysMax: z.number().int().nonnegative(),
});

export type ShippingMethod = z.infer<typeof ShippingMethodSchema>;

// ==========================================
// 4. Shipments & Packages
// ==========================================
export const CodStatusEnum = [
  "PENDING_COLLECTION",
  "COLLECTED",
  "REMITTED",
  "REFUSED",
] as const;

export type CodStatus = (typeof CodStatusEnum)[number];

export const CodStatusSchema = z.enum(CodStatusEnum);

export const CreateShipmentItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  weight: z.number().positive().optional().nullable(),
  sku: z.string().optional().nullable(),
});

export type CreateShipmentItem = z.infer<typeof CreateShipmentItemSchema>;

export const CreateShipmentPackageSchema = z.object({
  weight: z.number().positive("Weight must be positive in kg"),
  length: z.number().positive().optional().nullable(),
  width: z.number().positive().optional().nullable(),
  height: z.number().positive().optional().nullable(),
  packageType: z.string().optional().default("box"),
});

export type CreateShipmentPackage = z.infer<typeof CreateShipmentPackageSchema>;

export const CreateShipmentRequestSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  userId: z.string().optional().nullable(),
  carrier: z.string().min(1, "Carrier is required"),
  serviceType: z.string().default("standard"),
  shippingAddress: ShippingAddressSnapshotSchema,
  items: z
    .array(CreateShipmentItemSchema)
    .min(1, "At least one item is required"),
  packages: z.array(CreateShipmentPackageSchema).optional().default([]),
  shippingRateAmount: z.number().nonnegative().optional().default(0),
  currency: z.string().optional().default("PKR"),
  isCod: z.boolean().optional().default(false),
  codAmount: z.number().nonnegative().optional().nullable(),
  codFee: z.number().nonnegative().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateShipmentRequest = z.input<typeof CreateShipmentRequestSchema>;

export const ShipmentItemSchema = CreateShipmentItemSchema.extend({
  id: z.string(),
  shipmentId: z.string(),
});

export type ShipmentItem = z.infer<typeof ShipmentItemSchema>;

export const ShipmentPackageSchema = CreateShipmentPackageSchema.extend({
  id: z.string(),
  shipmentId: z.string(),
});

export type ShipmentPackage = z.infer<typeof ShipmentPackageSchema>;

export const ShippingLabelSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  carrier: z.string(),
  trackingNumber: z.string(),
  format: z.enum(["pdf", "zpl", "png"]).default("pdf"),
  labelUrl: z.string(),
  cost: z.number().nonnegative().optional().nullable(),
  createdAt: z.string().or(z.date()),
});

export type ShippingLabel = z.infer<typeof ShippingLabelSchema>;

export const ShipmentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  userId: z.string().nullable().optional(),
  carrier: z.string(),
  serviceType: z.string(),
  trackingNumber: z.string().nullable().optional(),
  status: ShipmentStatusSchema,
  shippingAddress: ShippingAddressSnapshotSchema,
  shippingRateAmount: z.number().nonnegative(),
  currency: z.string(),
  isCod: z.boolean().default(false),
  codAmount: z.number().nonnegative().nullable().optional(),
  codFee: z.number().nonnegative().nullable().optional(),
  codStatus: z.string().nullable().optional(),
  estimatedDeliveryAt: z.string().or(z.date()).nullable().optional(),
  shippedAt: z.string().or(z.date()).nullable().optional(),
  deliveredAt: z.string().or(z.date()).nullable().optional(),
  items: z.array(ShipmentItemSchema).optional().default([]),
  packages: z.array(ShipmentPackageSchema).optional().default([]),
  labels: z.array(ShippingLabelSchema).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type Shipment = z.infer<typeof ShipmentSchema>;

// ==========================================
// 5. Tracking & Events
// ==========================================
export const TrackingEventSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  status: ShipmentStatusSchema,
  description: z.string(),
  location: z.string().nullable().optional(),
  occurredAt: z.string().or(z.date()),
  source: z.enum(["carrier_webhook", "carrier_poll", "manual"]),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type TrackingEvent = z.infer<typeof TrackingEventSchema>;

export const TrackingResultSchema = z.object({
  shipmentId: z.string(),
  carrier: z.string(),
  trackingNumber: z.string(),
  status: ShipmentStatusSchema,
  estimatedDeliveryAt: z.string().or(z.date()).nullable().optional(),
  isCod: z.boolean().optional(),
  codAmount: z.number().nullable().optional(),
  codStatus: z.string().nullable().optional(),
  events: z.array(TrackingEventSchema),
  lastUpdated: z.string().or(z.date()),
});

export type TrackingResult = z.infer<typeof TrackingResultSchema>;

// ==========================================
// 6. Carrier Provider Interface
// ==========================================
export interface ShipmentResult {
  carrier: string;
  trackingNumber: string;
  labelUrl?: string;
  estimatedDeliveryAt?: Date | string;
  isCod?: boolean;
  codAmount?: number | null;
  codFee?: number | null;
  metadata?: Record<string, unknown>;
}

export interface CancelShipmentRequest {
  shipmentId: string;
  trackingNumber?: string;
  carrier: string;
  reason?: string;
}

export const CreateLabelRequestSchema = z.object({
  shipmentId: z.string().min(1, "Shipment ID is required"),
  format: z.enum(["pdf", "zpl", "png"]).optional().default("pdf"),
});

export type CreateLabelRequest = z.infer<typeof CreateLabelRequestSchema>;

export interface ShippingProvider {
  readonly carrierCode: string;
  getRates(request: ShippingRateRequest): Promise<ShippingRate[]>;
  createShipment(request: CreateShipmentRequest): Promise<ShipmentResult>;
  cancelShipment(request: CancelShipmentRequest): Promise<void>;
  getTracking(trackingNumber: string): Promise<TrackingResult>;
  createLabel(
    request: CreateLabelRequest & { trackingNumber: string },
  ): Promise<ShippingLabel>;
}

// ==========================================
// 7. Kafka Domain Events
// ==========================================
export interface ShipmentCreatedPayload {
  eventId: string;
  eventType: "shipment.created";
  shipmentId: string;
  orderId: string;
  userId?: string | null;
  carrier: string;
  trackingNumber?: string | null;
  status: ShipmentStatus;
  shippingRateAmount: number;
  currency: string;
  isCod?: boolean;
  codAmount?: number | null;
  codFee?: number | null;
  codStatus?: string | null;
  timestamp: string;
}

export interface ShipmentLabelCreatedPayload {
  eventId: string;
  eventType: "shipment.label_created";
  shipmentId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  labelUrl: string;
  timestamp: string;
}

export interface ShipmentShippedPayload {
  eventId: string;
  eventType: "shipment.shipped";
  shipmentId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  shippedAt: string;
  timestamp: string;
}

export interface ShipmentInTransitPayload {
  eventId: string;
  eventType: "shipment.in_transit";
  shipmentId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  location?: string | null;
  timestamp: string;
}

export interface ShipmentOutForDeliveryPayload {
  eventId: string;
  eventType: "shipment.out_for_delivery";
  shipmentId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  timestamp: string;
}

export interface ShipmentDeliveredPayload {
  eventId: string;
  eventType: "shipment.delivered";
  shipmentId: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  deliveredAt: string;
  timestamp: string;
}

export interface ShipmentCancelledPayload {
  eventId: string;
  eventType: "shipment.cancelled";
  shipmentId: string;
  orderId: string;
  reason?: string;
  timestamp: string;
}

export interface ShipmentFailedPayload {
  eventId: string;
  eventType: "shipment.failed";
  shipmentId: string;
  orderId: string;
  reason?: string;
  timestamp: string;
}

export interface TrackingUpdatedPayload {
  eventId: string;
  eventType: "tracking.updated";
  shipmentId: string;
  trackingNumber: string;
  carrier: string;
  status: ShipmentStatus;
  description: string;
  location?: string | null;
  occurredAt: string;
  timestamp: string;
}

export type ShippingKafkaEventPayload =
  | ShipmentCreatedPayload
  | ShipmentLabelCreatedPayload
  | ShipmentShippedPayload
  | ShipmentInTransitPayload
  | ShipmentOutForDeliveryPayload
  | ShipmentDeliveredPayload
  | ShipmentCancelledPayload
  | ShipmentFailedPayload
  | TrackingUpdatedPayload;
