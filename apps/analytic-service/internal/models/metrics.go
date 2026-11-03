package models

// AnalyticsSummary represents the real-time KPI overview payload matching @repo/types.
type AnalyticsSummary struct {
	TotalRevenue            float64 `json:"totalRevenue"`
	TotalOrders             int64   `json:"totalOrders"`
	TotalSignups            int64   `json:"totalSignups"`
	TotalProductsCreated    int64   `json:"totalProductsCreated"`
	TotalProductsDeleted    int64   `json:"totalProductsDeleted"`
	TotalCartsCreated       int64   `json:"totalCartsCreated,omitempty"`
	TotalCartsUpdated       int64   `json:"totalCartsUpdated,omitempty"`
	TotalCartsExpired       int64   `json:"totalCartsExpired,omitempty"`
	TotalTaxCollected       float64 `json:"totalTaxCollected,omitempty"`
	TotalTaxCalculations    int64   `json:"totalTaxCalculations,omitempty"`
	TotalVendorsRegistered  int64   `json:"totalVendorsRegistered,omitempty"`
	TotalVendorsVerified    int64   `json:"totalVendorsVerified,omitempty"`
	TotalSellersCreated     int64   `json:"totalSellersCreated,omitempty"`
	TotalSellersActive      int64   `json:"totalSellersActive,omitempty"`
	TotalShipmentsDelivered int64   `json:"totalShipmentsDelivered,omitempty"`
	DeliverySuccessRate     float64 `json:"deliverySuccessRate,omitempty"`
	TotalReturnsCompleted   int64   `json:"totalReturnsCompleted,omitempty"`
	TotalDiscountsApplied   int64   `json:"totalDiscountsApplied,omitempty"`
	LastEventTime           string  `json:"lastEventTime"`
	IsDbConnected           bool    `json:"isDbConnected"`
}

// MerchantAnalyticsMetrics represents merchant & vendor ecosystem statistics.
type MerchantAnalyticsMetrics struct {
	TotalVendorsRegistered int64  `json:"totalVendorsRegistered"`
	TotalVendorsVerified   int64  `json:"totalVendorsVerified"`
	TotalVendorsSuspended  int64  `json:"totalVendorsSuspended"`
	TotalSellersCreated    int64  `json:"totalSellersCreated"`
	TotalSellersActive     int64  `json:"totalSellersActive"`
	TotalSellersSuspended  int64  `json:"totalSellersSuspended"`
	LastEventTime          string `json:"lastEventTime"`
}

// OperationsAnalyticsMetrics represents fulfillment, inventory, shipping, and returns telemetry.
type OperationsAnalyticsMetrics struct {
	TotalShipmentsCreated   int64   `json:"totalShipmentsCreated"`
	TotalShipmentsShipped   int64   `json:"totalShipmentsShipped"`
	TotalShipmentsDelivered int64   `json:"totalShipmentsDelivered"`
	TotalShipmentsFailed    int64   `json:"totalShipmentsFailed"`
	DeliverySuccessRate     float64 `json:"deliverySuccessRate"`
	TotalStockSold          int64   `json:"totalStockSold"`
	TotalLowStockAlerts     int64   `json:"totalLowStockAlerts"`
	TotalRestocks           int64   `json:"totalRestocks"`
	TotalReturnsRequested   int64   `json:"totalReturnsRequested"`
	TotalReturnsInspected   int64   `json:"totalReturnsInspected"`
	TotalReturnsCompleted   int64   `json:"totalReturnsCompleted"`
	TotalReturnsRejected    int64   `json:"totalReturnsRejected"`
	TotalRefundAmount       float64 `json:"totalRefundAmount"`
	TotalDisputesOpened     int64   `json:"totalDisputesOpened"`
	TotalDisputesResolved   int64   `json:"totalDisputesResolved"`
	LastEventTime           string  `json:"lastEventTime"`
}

// CommerceAnalyticsMetrics represents financial, promotional, tax, and checkout conversion telemetry.
type CommerceAnalyticsMetrics struct {
	TotalRevenue          float64 `json:"totalRevenue"`
	TotalOrders           int64   `json:"totalOrders"`
	TotalTaxCalculations  int64   `json:"totalTaxCalculations"`
	TotalTaxCollected     float64 `json:"totalTaxCollected"`
	TotalCouponsApplied   int64   `json:"totalCouponsApplied"`
	TotalDiscountsApplied int64   `json:"totalDiscountsApplied"`
	TotalCampaignsCreated int64   `json:"totalCampaignsCreated"`
	TotalDiscountSavings  float64 `json:"totalDiscountSavings"`
	TotalCartsCreated     int64   `json:"totalCartsCreated"`
	TotalCartsUpdated     int64   `json:"totalCartsUpdated"`
	TotalCartsExpired     int64   `json:"totalCartsExpired"`
	LastEventTime         string  `json:"lastEventTime"`
}

// PublicTrustMetrics represents platform trust and social proof metrics for public storefront.
type PublicTrustMetrics struct {
	ActiveSellersCount   int64   `json:"activeSellersCount"`
	VerifiedVendorsCount int64   `json:"verifiedVendorsCount"`
	TotalProductsCount   int64   `json:"totalProductsCount"`
	DeliverySuccessRate  float64 `json:"deliverySuccessRate"`
	OrdersFulfilledCount int64   `json:"ordersFulfilledCount"`
	LastUpdated          string  `json:"lastUpdated"`
}

// AnalyticsDailyChart represents daily aggregated revenue, orders, and signups.
type AnalyticsDailyChart struct {
	Date                 string  `json:"date"`
	TotalRevenue         float64 `json:"total_revenue"`
	TotalOrders          int64   `json:"total_orders"`
	TotalSignups         int64   `json:"total_signups"`
	TotalProductsCreated int64   `json:"total_products_created"`
}
