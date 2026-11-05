// seller.ts types (re-export from local to avoid @repo/types dependency issues in Nuxt)

export interface Seller {
  id: string;
  vendorId: string;
  primaryUserId: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ONBOARDING";
  createdAt: string;
  updatedAt: string;
  store?: SellerStore;
  settings?: SellerSettings;
}

export interface SellerStore {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  headline: string | null;
  description: string | null;
  logoMediaId: string | null;
  bannerMediaId: string | null;
  status: "ACTIVE" | "INACTIVE";
  vacationMode: boolean;
  vacationMessage: string | null;
  vacationEndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerSettings {
  id: string;
  sellerId: string;
  defaultCurrency: string;
  autoAcceptOrders: boolean;
  lowStockThreshold: number;
  supportEmail: string | null;
  supportPhone: string | null;
  shippingOriginPostalCode: string | null;
  notificationPreferences: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface SellerStaff {
  id: string;
  sellerId: string;
  userId: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SellerPolicy {
  id: string;
  sellerId: string;
  policyType: "RETURN" | "SHIPPING" | "PRIVACY" | "TERMS" | "PAYMENT";
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerPerformance {
  id: string;
  sellerId: string;
  rating: string;
  totalReviews: number;
  orderFulfillmentRate: string;
  cancellationRate: string;
  totalOrdersCompleted: number;
  responseTimeHours: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  businessType: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "UNDER_REVIEW";
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerBalance {
  available: number;
  pending: number;
  currency: string;
}

export interface Payout {
  id: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  method: string;
  createdAt: string;
  processedAt: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE" | "DRAFT" | "ARCHIVED";
  price: number;
  currency: string;
  images: string[];
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "PENDING_USER" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface SellerOrder {
  id: string;
  status: string;
  total: number;
  currency: string;
  buyerUserId: string;
  createdAt: string;
  updatedAt: string;
  items: SellerOrderItem[];
}

export interface SellerOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SystemSettings {
  isSeller: boolean;
  maintenanceMode: boolean;
  allowRegistrations: boolean;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
