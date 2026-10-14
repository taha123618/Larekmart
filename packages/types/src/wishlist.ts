import { z } from "zod";

// ==============================================================================
// Enums & Constants
// ==============================================================================

export const WishlistVisibility = {
  PRIVATE: "PRIVATE",
  PUBLIC: "PUBLIC",
  SHARED: "SHARED",
} as const;
export type WishlistVisibility =
  (typeof WishlistVisibility)[keyof typeof WishlistVisibility];

export const SharePermission = {
  VIEW: "VIEW",
  EDIT: "EDIT",
} as const;
export type SharePermission =
  (typeof SharePermission)[keyof typeof SharePermission];

export const WishlistEventType = {
  CREATED: "CREATED",
  ITEM_ADDED: "ITEM_ADDED",
  ITEM_REMOVED: "ITEM_REMOVED",
  ITEM_MOVED: "ITEM_MOVED",
  MERGED: "MERGED",
  SHARED: "SHARED",
  UPDATED: "UPDATED",
  DELETED: "DELETED",
} as const;
export type WishlistEventType =
  (typeof WishlistEventType)[keyof typeof WishlistEventType];

// ==============================================================================
// Zod Schemas
// ==============================================================================

export const CreateWishlistSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  visibility: z
    .enum(["PRIVATE", "PUBLIC", "SHARED"])
    .optional()
    .default("PRIVATE"),
  isDefault: z.boolean().optional().default(false),
});
export type CreateWishlistInput = z.infer<typeof CreateWishlistSchema>;

export const UpdateWishlistSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters")
    .trim()
    .optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "SHARED"]).optional(),
});
export type UpdateWishlistInput = z.infer<typeof UpdateWishlistSchema>;

export const AddWishlistItemSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  variantId: z.string().nullable().optional(),
  addedPrice: z
    .number()
    .nonnegative("Added price must be non-negative")
    .optional()
    .default(0),
  note: z.string().max(500, "Note cannot exceed 500 characters").optional(),
  priority: z
    .number()
    .int()
    .min(0, "Priority must be at least 0")
    .max(5, "Priority cannot exceed 5")
    .optional()
    .default(0),
});
export type AddWishlistItemInput = z.infer<typeof AddWishlistItemSchema>;

export const UpdateWishlistItemSchema = z.object({
  note: z.string().max(500, "Note cannot exceed 500 characters").optional(),
  priority: z.number().int().min(0).max(5).optional(),
});
export type UpdateWishlistItemInput = z.infer<typeof UpdateWishlistItemSchema>;

export const MoveWishlistItemSchema = z.object({
  targetWishlistId: z.string().uuid("targetWishlistId must be a valid UUID"),
});
export type MoveWishlistItemInput = z.infer<typeof MoveWishlistItemSchema>;

export const MergeWishlistSchema = z.object({
  guestId: z.string().min(1, "guestId is required"),
  conflictStrategy: z
    .enum(["KEEP_EXISTING", "OVERWRITE"])
    .optional()
    .default("KEEP_EXISTING"),
});
export type MergeWishlistInput = z.infer<typeof MergeWishlistSchema>;

export const CreateShareTokenSchema = z.object({
  permission: z.enum(["VIEW", "EDIT"]).optional().default("VIEW"),
  expiresInDays: z
    .number()
    .int()
    .positive("Expiration days must be positive")
    .max(365, "Expiration cannot exceed 365 days")
    .optional(),
});
export type CreateShareTokenInput = z.infer<typeof CreateShareTokenSchema>;

export const BulkRemoveItemsSchema = z.object({
  itemIds: z
    .array(z.string().uuid("Invalid item ID format"))
    .min(1, "At least one itemId is required")
    .max(100, "Cannot remove more than 100 items at once"),
});
export type BulkRemoveItemsInput = z.infer<typeof BulkRemoveItemsSchema>;

export const WishlistQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type WishlistQueryInput = z.infer<typeof WishlistQuerySchema>;

// ==============================================================================
// Domain Models / Interfaces
// ==============================================================================

export interface Wishlist {
  id: string;
  userId: string | null;
  guestId: string | null;
  name: string;
  isDefault: boolean;
  visibility: WishlistVisibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface WishlistItem {
  id: string;
  wishlistId: string;
  productId: string;
  variantId: string | null;
  addedPrice: number;
  currentPrice: number | null;
  inStock: boolean;
  note: string | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WishlistShare {
  id: string;
  wishlistId: string;
  shareToken: string;
  permission: SharePermission;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface WishlistEventRecord {
  id: string;
  wishlistId: string;
  eventType: WishlistEventType;
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface WishlistWithItems extends Wishlist {
  items: WishlistItem[];
  itemCount: number;
}

// ==============================================================================
// Kafka Event Contracts
// ==============================================================================

export interface WishlistCreatedEvent {
  wishlistId: string;
  userId: string | null;
  guestId: string | null;
  name: string;
  isDefault: boolean;
  visibility: WishlistVisibility;
  createdAt: string;
}

export interface WishlistItemAddedEvent {
  wishlistId: string;
  itemId: string;
  userId: string | null;
  guestId: string | null;
  productId: string;
  variantId: string | null;
  addedPrice: number;
  addedAt: string;
}

export interface WishlistItemRemovedEvent {
  wishlistId: string;
  itemId: string;
  userId: string | null;
  guestId: string | null;
  productId: string;
  variantId: string | null;
  removedAt: string;
}

export interface WishlistItemMovedEvent {
  sourceWishlistId: string;
  targetWishlistId: string;
  itemId: string;
  userId: string | null;
  productId: string;
  variantId: string | null;
  movedAt: string;
}

export interface WishlistMergedEvent {
  userId: string;
  guestId: string;
  wishlistId: string;
  mergedCount: number;
  mergedAt: string;
}

export interface WishlistPriceDropAlertEvent {
  userId: string;
  wishlistId: string;
  itemId: string;
  productId: string;
  variantId: string | null;
  oldPrice: number;
  newPrice: number;
  dropPercentage: number;
  detectedAt: string;
}

export interface WishlistRestockedAlertEvent {
  userId: string;
  wishlistId: string;
  itemId: string;
  productId: string;
  variantId: string | null;
  availableQuantity: number;
  detectedAt: string;
}
