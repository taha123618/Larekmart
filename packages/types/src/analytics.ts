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
  lastEventTime: string;
  isDbConnected: boolean;
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
