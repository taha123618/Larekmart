import {
  mysqlTable,
  varchar,
  decimal,
  boolean,
  int,
  timestamp,
  text,
} from "drizzle-orm/mysql-core";

/**
 * 1. return_policy_versions
 * Versioned return windows, grace periods, and restocking parameters
 */
export const returnPolicyVersions = mysqlTable("return_policy_versions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  version: varchar("version", { length: 32 }).notNull().unique(),
  returnWindowDays: int("return_window_days").notNull().default(14),
  warrantyGraceDays: int("warranty_grace_days").notNull().default(30),
  restockingFeePercentage: decimal("restocking_fee_percentage", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  requiresReceipt: boolean("requires_receipt").notNull().default(true),
  effectiveDate: timestamp("effective_date").defaultNow().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 2. return_reasons
 * Master list of accepted return reasons and metadata
 */
export const returnReasons = mysqlTable("return_reasons", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description"),
  requiresEvidence: boolean("requires_evidence").notNull().default(false),
  isSellerFault: boolean("is_seller_fault").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 3. returns
 * Authoritative return requests and status tracking
 */
export const returns = mysqlTable("returns", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 128 }).notNull(),
  customerId: varchar("customer_id", { length: 128 }).notNull(),
  sellerId: varchar("seller_id", { length: 128 }),
  status: varchar("status", { length: 64 }).notNull().default("REQUESTED"),
  reasonCategory: varchar("reason_category", { length: 64 }).notNull(),
  customerComments: text("customer_comments"),
  subtotalRefund: decimal("subtotal_refund", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  taxRefund: decimal("tax_refund", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  shippingDeduction: decimal("shipping_deduction", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  totalRefund: decimal("total_refund", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  policyVersion: varchar("policy_version", { length: 32 })
    .notNull()
    .default("1.0.0"),
  requiresManualReview: boolean("requires_manual_review")
    .notNull()
    .default(false),
  autoApproved: boolean("auto_approved").notNull().default(false),
  deliveredAt: timestamp("delivered_at"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  receivedAt: timestamp("received_at"),
  inspectedAt: timestamp("inspected_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * 4. return_items
 * Itemized breakdown of returned quantities, prices, and prorations
 */
export const returnItems = mysqlTable("return_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  orderItemId: varchar("order_item_id", { length: 128 }).notNull(),
  productId: varchar("product_id", { length: 128 }).notNull(),
  variantId: varchar("variant_id", { length: 128 }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  itemDiscount: decimal("item_discount", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  proratedTax: decimal("prorated_tax", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  refundSubtotal: decimal("refund_subtotal", {
    precision: 12,
    scale: 2,
  }).notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  condition: varchar("condition", { length: 64 }).notNull().default("UNOPENED"),
  customerNote: text("customer_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 5. return_media
 * Customer and seller evidence attachments (media-service asset IDs)
 */
export const returnMedia = mysqlTable("return_media", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  mediaId: varchar("media_id", { length: 128 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  mediaType: varchar("media_type", { length: 32 }).notNull().default("PHOTO"),
  uploaderRole: varchar("uploader_role", { length: 32 })
    .notNull()
    .default("CUSTOMER"),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 6. return_shipments
 * Inbound return carrier labels and tracking information
 */
export const returnShipments = mysqlTable("return_shipments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  carrierName: varchar("carrier_name", { length: 64 }).notNull(),
  trackingNumber: varchar("tracking_number", { length: 128 }).notNull(),
  labelUrl: varchar("label_url", { length: 512 }),
  isPrepaid: boolean("is_prepaid").notNull().default(false),
  paidBy: varchar("paid_by", { length: 32 }).notNull().default("SELLER"),
  shippingFee: decimal("shipping_fee", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  trackingStatus: varchar("tracking_status", { length: 64 })
    .notNull()
    .default("LABEL_CREATED"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * 7. return_inspections
 * Warehouse or seller received item inspection and restocking outcomes
 */
export const returnInspections = mysqlTable("return_inspections", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  inspectorId: varchar("inspector_id", { length: 128 }).notNull(),
  overallCondition: varchar("overall_condition", { length: 64 }).notNull(),
  disposition: varchar("disposition", { length: 64 }).notNull(),
  notes: text("notes"),
  inspectedAt: timestamp("inspected_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 8. return_refunds
 * Financial refund requests, Stripe intents, and settlement statuses
 */
export const returnRefunds = mysqlTable("return_refunds", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  paymentIntentId: varchar("payment_intent_id", { length: 128 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 })
    .notNull()
    .unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  shippingDeduction: decimal("shipping_deduction", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"),
  stripeRefundId: varchar("stripe_refund_id", { length: 128 }),
  failureReason: text("failure_reason"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 9. return_state_transitions
 * Comprehensive audit trail of all lifecycle status changes
 */
export const returnStateTransitions = mysqlTable("return_state_transitions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  returnId: varchar("return_id", { length: 36 }).notNull(),
  previousState: varchar("previous_state", { length: 64 }).notNull(),
  newState: varchar("new_state", { length: 64 }).notNull(),
  actorId: varchar("actor_id", { length: 128 }).notNull(),
  actorRole: varchar("actor_role", { length: 32 }).notNull(),
  reasonNote: text("reason_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 10. return_outbox
 * Transactional outbox for reliable asynchronous event publishing
 */
export const returnOutbox = mysqlTable("return_outbox", {
  id: varchar("id", { length: 36 }).primaryKey(),
  topic: varchar("topic", { length: 128 }).notNull(),
  eventKey: varchar("event_key", { length: 128 }),
  payload: text("payload").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"),
  retryCount: int("retry_count").notNull().default(0),
  lastError: text("last_error"),
  lockedBy: varchar("locked_by", { length: 128 }),
  lockedUntil: timestamp("locked_until"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
