export type AnalyticsSummaryType = {
  totalRevenue: number;
  totalOrders: number;
  totalSignups: number;
  totalProductsCreated: number;
  totalProductsDeleted: number;
  totalCartsCreated?: number;
  totalCartsUpdated?: number;
  totalCartsExpired?: number;
  totalTaxCollected?: number;
  totalTaxCalculations?: number;
  totalVendorsRegistered?: number;
  totalVendorsVerified?: number;
  totalSellersCreated?: number;
  totalSellersActive?: number;
  totalShipmentsDelivered?: number;
  deliverySuccessRate?: number;
  totalReturnsCompleted?: number;
  totalDiscountsApplied?: number;
  lastEventTime: string;
  isDbConnected: boolean;
};

export type MerchantAnalyticsMetricsType = {
  totalVendorsRegistered: number;
  totalVendorsVerified: number;
  totalVendorsSuspended: number;
  totalSellersCreated: number;
  totalSellersActive: number;
  totalSellersSuspended: number;
  lastEventTime: string;
};

export type OperationsAnalyticsMetricsType = {
  totalShipmentsCreated: number;
  totalShipmentsShipped: number;
  totalShipmentsDelivered: number;
  totalShipmentsFailed: number;
  deliverySuccessRate: number;
  totalStockSold: number;
  totalLowStockAlerts: number;
  totalRestocks: number;
  totalReturnsRequested: number;
  totalReturnsInspected: number;
  totalReturnsCompleted: number;
  totalReturnsRejected: number;
  totalRefundAmount: number;
  totalDisputesOpened: number;
  totalDisputesResolved: number;
  lastEventTime: string;
};

export type CommerceAnalyticsMetricsType = {
  totalRevenue: number;
  totalOrders: number;
  totalTaxCalculations: number;
  totalTaxCollected: number;
  totalCouponsApplied: number;
  totalDiscountsApplied: number;
  totalCampaignsCreated: number;
  totalDiscountSavings: number;
  totalCartsCreated: number;
  totalCartsUpdated: number;
  totalCartsExpired: number;
  lastEventTime: string;
};

export type PublicTrustMetricsType = {
  activeSellersCount: number;
  verifiedVendorsCount: number;
  totalProductsCount: number;
  deliverySuccessRate: number;
  ordersFulfilledCount: number;
  lastUpdated: string;
};

export type AnalyticsDailyChartType = {
  date: string;
  total_revenue: number;
  total_orders: number;
  total_signups: number;
  total_products_created: number;
};

export type AnalyticsEventType = {
  id: number;
  event_type: string;
  user_id: string | null;
  amount: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
