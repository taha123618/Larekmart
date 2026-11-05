import type {
  Seller,
  SellerStore,
  SellerPolicy,
  SellerStaff,
  SellerSettings,
  SellerPerformanceSnapshot,
  SellerStatus,
  StorefrontStatus,
  StaffRole,
  StaffStatus,
  PolicyType,
} from "@repo/types";

export type {
  Seller,
  SellerStore,
  SellerPolicy,
  SellerStaff,
  SellerSettings,
  SellerPerformanceSnapshot,
  SellerStatus,
  StorefrontStatus,
  StaffRole,
  StaffStatus,
  PolicyType,
};

// Re-export or define vendor types
export type VendorStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED"
  | "TERMINATED"
  | "DEACTIVATED";

export type OrganizationType =
  | "CORPORATION"
  | "LLC"
  | "PARTNERSHIP"
  | "SOLE_PROPRIETORSHIP";

export interface Vendor {
  id: string;
  name: string;
  legalBusinessName: string;
  organizationType: OrganizationType;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  status: VendorStatus;
  primaryContactEmail: string;
  primaryContactPhone: string;
  country: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  website?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Product types
export interface Product {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  sku: string;
  price: number;
  currency: string;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  stockQuantity: number;
  category: string;
  categoryId?: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "OUT_OF_STOCK";
  images: string[];
  attributes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Inventory types
export interface InventoryStock {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  availableStock: number;
  reservedStock: number;
  safetyStock: number;
  reorderPoint: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  updatedAt: string;
}

// Order types
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export interface Order {
  id: string;
  orderNumber: string;
  sellerId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  itemsCount: number;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

// Finance types
export interface SellerBalance {
  sellerId: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  totalEarnings: number;
  lastPayoutDate?: string | null;
  lastPayoutAmount?: number | null;
}

export interface PayoutRecord {
  id: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  method: string;
  referenceNumber: string;
  destinationAccount: string;
  createdAt: string;
  completedAt?: string | null;
}

export interface SettlementStatement {
  id: string;
  sellerId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  commissionFee: number;
  shippingFee: number;
  refunds: number;
  netPayout: number;
  currency: string;
  status: "DRAFT" | "FINALIZED" | "PAID";
  downloadUrl?: string;
  createdAt: string;
}

// Support types
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  sellerId: string;
  subject: string;
  category: "ORDERS" | "PAYMENTS" | "CATALOG" | "ACCOUNT" | "TECHNICAL";
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  assignedAgent?: string | null;
  responsesCount: number;
  lastRepliedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Chat types
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: "SELLER" | "CUSTOMER" | "SUPPORT";
  senderName: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface ChatConversation {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  productId?: string;
  productName?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: "ACTIVE" | "ARCHIVED";
}

// Auth & User types
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  imageUrl?: string;
  roles?: string[];
}
