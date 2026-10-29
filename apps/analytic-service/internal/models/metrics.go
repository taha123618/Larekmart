package models

// AnalyticsSummary represents the real-time KPI overview payload matching @repo/types.
type AnalyticsSummary struct {
	TotalRevenue           float64 `json:"totalRevenue"`
	TotalOrders            int64   `json:"totalOrders"`
	TotalSignups           int64   `json:"totalSignups"`
	TotalProductsCreated   int64   `json:"totalProductsCreated"`
	TotalProductsDeleted   int64   `json:"totalProductsDeleted"`
	TotalCartsCreated      int64   `json:"totalCartsCreated,omitempty"`
	TotalCartsUpdated      int64   `json:"totalCartsUpdated,omitempty"`
	TotalCartsExpired      int64   `json:"totalCartsExpired,omitempty"`
	TotalTaxCollected      float64 `json:"totalTaxCollected,omitempty"`
	TotalTaxCalculations   int64   `json:"totalTaxCalculations,omitempty"`
	TotalVendorsRegistered int64   `json:"totalVendorsRegistered,omitempty"`
	TotalVendorsVerified   int64   `json:"totalVendorsVerified,omitempty"`
	TotalSellersCreated    int64   `json:"totalSellersCreated,omitempty"`
	TotalSellersActive     int64   `json:"totalSellersActive,omitempty"`
	LastEventTime          string  `json:"lastEventTime"`
	IsDbConnected          bool    `json:"isDbConnected"`
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

// AnalyticsDailyChart represents daily aggregated revenue, orders, and signups.
type AnalyticsDailyChart struct {
	Date                 string  `json:"date"`
	TotalRevenue         float64 `json:"total_revenue"`
	TotalOrders          int64   `json:"total_orders"`
	TotalSignups         int64   `json:"total_signups"`
	TotalProductsCreated int64   `json:"total_products_created"`
}
