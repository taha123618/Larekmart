import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ==============================================================================
// 1. Wishlists Table
// ==============================================================================

export const wishlists = pgTable(
  "wishlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 }),
    guestId: varchar("guest_id", { length: 255 }),
    name: varchar("name", { length: 255 }).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    visibility: varchar("visibility", { length: 50 })
      .default("PRIVATE")
      .notNull(), // PRIVATE, PUBLIC, SHARED
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("wishlists_user_idx").on(table.userId),
    index("wishlists_guest_idx").on(table.guestId),
  ],
);

// ==============================================================================
// 2. Wishlist Items Table
// ==============================================================================

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wishlistId: uuid("wishlist_id")
      .references(() => wishlists.id, { onDelete: "cascade" })
      .notNull(),
    productId: varchar("product_id", { length: 255 }).notNull(),
    variantId: varchar("variant_id", { length: 255 }),
    addedPrice: numeric("added_price", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    currentPrice: numeric("current_price", { precision: 12, scale: 2 }),
    inStock: boolean("in_stock").default(true).notNull(),
    note: text("note"),
    priority: smallint("priority").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("wishlist_items_wishlist_idx").on(table.wishlistId),
    index("wishlist_items_product_idx").on(table.productId),
  ],
);

// ==============================================================================
// 3. Wishlist Shares Table
// ==============================================================================

export const wishlistShares = pgTable(
  "wishlist_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wishlistId: uuid("wishlist_id")
      .references(() => wishlists.id, { onDelete: "cascade" })
      .notNull(),
    shareToken: varchar("share_token", { length: 255 }).notNull().unique(),
    permission: varchar("permission", { length: 50 }).default("VIEW").notNull(), // VIEW, EDIT
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("wishlist_shares_token_idx").on(table.shareToken),
    index("wishlist_shares_wishlist_idx").on(table.wishlistId),
  ],
);

// ==============================================================================
// 4. Wishlist Events Table (Audit History)
// ==============================================================================

export const wishlistEvents = pgTable(
  "wishlist_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wishlistId: uuid("wishlist_id")
      .references(() => wishlists.id, { onDelete: "cascade" })
      .notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    actorId: varchar("actor_id", { length: 255 }).notNull(),
    payload: jsonb("payload").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("wishlist_events_wishlist_idx").on(table.wishlistId),
    index("wishlist_events_type_idx").on(table.eventType),
    index("wishlist_events_created_idx").on(table.createdAt),
  ],
);
