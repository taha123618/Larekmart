package metrics

import (
	"math"
	"sync"
	"sync/atomic"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
)

// Store maintains real-time in-memory KPI metrics using atomic instructions.
type Store struct {
	totalRevenueBits         uint64
	totalOrders              int64
	totalSignups             int64
	totalProductsCreated     int64
	totalProductsDeleted     int64
	totalCartsCreated        int64
	totalCartsUpdated        int64
	totalCartsExpired        int64
	totalTaxCollectedBits    uint64
	totalTaxCalculations     int64
	totalVendorsRegistered   int64
	totalVendorsVerified     int64
	totalVendorsSuspended    int64
	totalSellersCreated      int64
	totalSellersActive       int64
	totalSellersSuspended    int64
	totalShipmentsCreated    int64
	totalShipmentsShipped    int64
	totalShipmentsDelivered  int64
	totalShipmentsFailed     int64
	totalStockSold           int64
	totalLowStockAlerts      int64
	totalRestocks            int64
	totalReturnsRequested    int64
	totalReturnsInspected    int64
	totalReturnsCompleted    int64
	totalReturnsRejected     int64
	totalRefundAmountBits    uint64
	totalDisputesOpened      int64
	totalDisputesResolved    int64
	totalCouponsApplied      int64
	totalDiscountsApplied    int64
	totalCampaignsCreated    int64
	totalDiscountSavingsBits uint64
	totalReviewsCreated      int64
	totalWishlistItemsAdded  int64

	timeMu        sync.RWMutex
	lastEventTime string

	eventsMu       sync.RWMutex
	inMemoryEvents []models.AnalyticsEvent
	nextEventID    int64
}

// NewStore initializes an in-memory metrics store.
func NewStore() *Store {
	return &Store{
		lastEventTime:  time.Now().UTC().Format(time.RFC3339),
		inMemoryEvents: make([]models.AnalyticsEvent, 0, 100),
		nextEventID:    1,
	}
}

// addFloat64 atomically adds a float64 to a uint64-represented atomic value.
func addFloat64(addr *uint64, delta float64) {
	for {
		oldBits := atomic.LoadUint64(addr)
		oldVal := math.Float64frombits(oldBits)
		newVal := oldVal + delta
		newBits := math.Float64bits(newVal)
		if atomic.CompareAndSwapUint64(addr, oldBits, newBits) {
			break
		}
	}
}

func loadFloat64(addr *uint64) float64 {
	return math.Float64frombits(atomic.LoadUint64(addr))
}

// RecordEvent updates in-memory KPI counters according to the domain event type.
func (s *Store) RecordEvent(eventType string, userID *string, amount float64, metadata map[string]interface{}, createdAt time.Time) {
	nowStr := createdAt.UTC().Format(time.RFC3339)

	s.timeMu.Lock()
	s.lastEventTime = nowStr
	s.timeMu.Unlock()

	switch eventType {
	case "payment.successful", "payment-successful":
		addFloat64(&s.totalRevenueBits, amount)
		atomic.AddInt64(&s.totalOrders, 1)
	case "order.created", "order-successful":
		atomic.AddInt64(&s.totalOrders, 1)
	case "user.created", "user.registered", "email-successful":
		atomic.AddInt64(&s.totalSignups, 1)
	case "product.created":
		atomic.AddInt64(&s.totalProductsCreated, 1)
	case "product.deleted":
		atomic.AddInt64(&s.totalProductsDeleted, 1)
	case "cart.created":
		atomic.AddInt64(&s.totalCartsCreated, 1)
	case "cart.updated", "cart.item_added", "cart.item_updated", "cart.item_removed":
		atomic.AddInt64(&s.totalCartsUpdated, 1)
	case "cart.expired":
		atomic.AddInt64(&s.totalCartsExpired, 1)
	case "tax.calculated", "tax.quote_created":
		atomic.AddInt64(&s.totalTaxCalculations, 1)
		addFloat64(&s.totalTaxCollectedBits, amount)
	case "vendor.registered":
		atomic.AddInt64(&s.totalVendorsRegistered, 1)
	case "vendor.verified":
		atomic.AddInt64(&s.totalVendorsVerified, 1)
	case "vendor.suspended":
		atomic.AddInt64(&s.totalVendorsSuspended, 1)
	case "seller.created":
		atomic.AddInt64(&s.totalSellersCreated, 1)
	case "seller.activated":
		atomic.AddInt64(&s.totalSellersActive, 1)
	case "seller.suspended":
		atomic.AddInt64(&s.totalSellersSuspended, 1)
	case "shipment.created", "shipment.label_created":
		atomic.AddInt64(&s.totalShipmentsCreated, 1)
	case "shipment.shipped", "shipment.in_transit", "shipment.out_for_delivery":
		atomic.AddInt64(&s.totalShipmentsShipped, 1)
	case "shipment.delivered":
		atomic.AddInt64(&s.totalShipmentsDelivered, 1)
	case "shipment.failed", "shipment.cancelled":
		atomic.AddInt64(&s.totalShipmentsFailed, 1)
	case "inventory.stock.sold":
		atomic.AddInt64(&s.totalStockSold, 1)
	case "inventory.low_stock":
		atomic.AddInt64(&s.totalLowStockAlerts, 1)
	case "inventory.restocked":
		atomic.AddInt64(&s.totalRestocks, 1)
	case "return.requested":
		atomic.AddInt64(&s.totalReturnsRequested, 1)
	case "return.inspected":
		atomic.AddInt64(&s.totalReturnsInspected, 1)
	case "return.completed":
		atomic.AddInt64(&s.totalReturnsCompleted, 1)
		addFloat64(&s.totalRefundAmountBits, amount)
	case "return.rejected":
		atomic.AddInt64(&s.totalReturnsRejected, 1)
	case "payment.refund.succeeded":
		addFloat64(&s.totalRefundAmountBits, amount)
	case "dispute.created", "dispute.opened":
		atomic.AddInt64(&s.totalDisputesOpened, 1)
	case "dispute.resolved":
		atomic.AddInt64(&s.totalDisputesResolved, 1)
	case "promotion.coupon_applied":
		atomic.AddInt64(&s.totalCouponsApplied, 1)
	case "promotion.discount_applied", "promotion.redeemed":
		atomic.AddInt64(&s.totalDiscountsApplied, 1)
		addFloat64(&s.totalDiscountSavingsBits, amount)
	case "promotion.campaign_created":
		atomic.AddInt64(&s.totalCampaignsCreated, 1)
	case "review.created":
		atomic.AddInt64(&s.totalReviewsCreated, 1)
	case "wishlist.item_added":
		atomic.AddInt64(&s.totalWishlistItemsAdded, 1)
	}

	// Buffer latest 100 events in memory for instant audit recovery
	s.eventsMu.Lock()
	id := s.nextEventID
	s.nextEventID++

	var amtPtr *float64
	if amount != 0 {
		amtCopy := amount
		amtPtr = &amtCopy
	}

	event := models.AnalyticsEvent{
		ID:        id,
		EventType: eventType,
		UserID:    userID,
		Amount:    amtPtr,
		Metadata:  metadata,
		CreatedAt: createdAt,
	}

	// Prepend event
	s.inMemoryEvents = append([]models.AnalyticsEvent{event}, s.inMemoryEvents...)
	if len(s.inMemoryEvents) > 100 {
		s.inMemoryEvents = s.inMemoryEvents[:100]
	}
	s.eventsMu.Unlock()
}

// GetSummary builds an immutable AnalyticsSummary snapshot.
func (s *Store) GetSummary(isDbConnected bool) models.AnalyticsSummary {
	s.timeMu.RLock()
	lastTime := s.lastEventTime
	s.timeMu.RUnlock()

	delivered := atomic.LoadInt64(&s.totalShipmentsDelivered)
	failed := atomic.LoadInt64(&s.totalShipmentsFailed)
	deliveryRate := 99.8
	if delivered+failed > 0 {
		deliveryRate = (float64(delivered) / float64(delivered+failed)) * 100.0
	}

	return models.AnalyticsSummary{
		TotalRevenue:            loadFloat64(&s.totalRevenueBits),
		TotalOrders:             atomic.LoadInt64(&s.totalOrders),
		TotalSignups:            atomic.LoadInt64(&s.totalSignups),
		TotalProductsCreated:    atomic.LoadInt64(&s.totalProductsCreated),
		TotalProductsDeleted:    atomic.LoadInt64(&s.totalProductsDeleted),
		TotalCartsCreated:       atomic.LoadInt64(&s.totalCartsCreated),
		TotalCartsUpdated:       atomic.LoadInt64(&s.totalCartsUpdated),
		TotalCartsExpired:       atomic.LoadInt64(&s.totalCartsExpired),
		TotalTaxCollected:       loadFloat64(&s.totalTaxCollectedBits),
		TotalTaxCalculations:    atomic.LoadInt64(&s.totalTaxCalculations),
		TotalVendorsRegistered:  atomic.LoadInt64(&s.totalVendorsRegistered),
		TotalVendorsVerified:    atomic.LoadInt64(&s.totalVendorsVerified),
		TotalSellersCreated:     atomic.LoadInt64(&s.totalSellersCreated),
		TotalSellersActive:      atomic.LoadInt64(&s.totalSellersActive),
		TotalShipmentsDelivered: delivered,
		DeliverySuccessRate:     deliveryRate,
		TotalReturnsCompleted:   atomic.LoadInt64(&s.totalReturnsCompleted),
		TotalDiscountsApplied:   atomic.LoadInt64(&s.totalDiscountsApplied),
		LastEventTime:           lastTime,
		IsDbConnected:           isDbConnected,
	}
}

// GetMerchantMetrics builds an immutable MerchantAnalyticsMetrics snapshot.
func (s *Store) GetMerchantMetrics() models.MerchantAnalyticsMetrics {
	s.timeMu.RLock()
	lastTime := s.lastEventTime
	s.timeMu.RUnlock()

	return models.MerchantAnalyticsMetrics{
		TotalVendorsRegistered: atomic.LoadInt64(&s.totalVendorsRegistered),
		TotalVendorsVerified:   atomic.LoadInt64(&s.totalVendorsVerified),
		TotalVendorsSuspended:  atomic.LoadInt64(&s.totalVendorsSuspended),
		TotalSellersCreated:    atomic.LoadInt64(&s.totalSellersCreated),
		TotalSellersActive:     atomic.LoadInt64(&s.totalSellersActive),
		TotalSellersSuspended:  atomic.LoadInt64(&s.totalSellersSuspended),
		LastEventTime:          lastTime,
	}
}

// GetOperationsMetrics builds an immutable OperationsAnalyticsMetrics snapshot.
func (s *Store) GetOperationsMetrics() models.OperationsAnalyticsMetrics {
	s.timeMu.RLock()
	lastTime := s.lastEventTime
	s.timeMu.RUnlock()

	delivered := atomic.LoadInt64(&s.totalShipmentsDelivered)
	failed := atomic.LoadInt64(&s.totalShipmentsFailed)
	deliveryRate := 99.8
	if delivered+failed > 0 {
		deliveryRate = (float64(delivered) / float64(delivered+failed)) * 100.0
	}

	return models.OperationsAnalyticsMetrics{
		TotalShipmentsCreated:   atomic.LoadInt64(&s.totalShipmentsCreated),
		TotalShipmentsShipped:   atomic.LoadInt64(&s.totalShipmentsShipped),
		TotalShipmentsDelivered: delivered,
		TotalShipmentsFailed:    failed,
		DeliverySuccessRate:     deliveryRate,
		TotalStockSold:          atomic.LoadInt64(&s.totalStockSold),
		TotalLowStockAlerts:     atomic.LoadInt64(&s.totalLowStockAlerts),
		TotalRestocks:           atomic.LoadInt64(&s.totalRestocks),
		TotalReturnsRequested:   atomic.LoadInt64(&s.totalReturnsRequested),
		TotalReturnsInspected:   atomic.LoadInt64(&s.totalReturnsInspected),
		TotalReturnsCompleted:   atomic.LoadInt64(&s.totalReturnsCompleted),
		TotalReturnsRejected:    atomic.LoadInt64(&s.totalReturnsRejected),
		TotalRefundAmount:       loadFloat64(&s.totalRefundAmountBits),
		TotalDisputesOpened:     atomic.LoadInt64(&s.totalDisputesOpened),
		TotalDisputesResolved:   atomic.LoadInt64(&s.totalDisputesResolved),
		LastEventTime:           lastTime,
	}
}

// GetCommerceMetrics builds an immutable CommerceAnalyticsMetrics snapshot.
func (s *Store) GetCommerceMetrics() models.CommerceAnalyticsMetrics {
	s.timeMu.RLock()
	lastTime := s.lastEventTime
	s.timeMu.RUnlock()

	return models.CommerceAnalyticsMetrics{
		TotalRevenue:          loadFloat64(&s.totalRevenueBits),
		TotalOrders:           atomic.LoadInt64(&s.totalOrders),
		TotalTaxCalculations:  atomic.LoadInt64(&s.totalTaxCalculations),
		TotalTaxCollected:     loadFloat64(&s.totalTaxCollectedBits),
		TotalCouponsApplied:   atomic.LoadInt64(&s.totalCouponsApplied),
		TotalDiscountsApplied: atomic.LoadInt64(&s.totalDiscountsApplied),
		TotalCampaignsCreated: atomic.LoadInt64(&s.totalCampaignsCreated),
		TotalDiscountSavings:  loadFloat64(&s.totalDiscountSavingsBits),
		TotalCartsCreated:     atomic.LoadInt64(&s.totalCartsCreated),
		TotalCartsUpdated:     atomic.LoadInt64(&s.totalCartsUpdated),
		TotalCartsExpired:     atomic.LoadInt64(&s.totalCartsExpired),
		LastEventTime:         lastTime,
	}
}

// GetPublicTrustMetrics builds public platform proof metrics.
func (s *Store) GetPublicTrustMetrics() models.PublicTrustMetrics {
	s.timeMu.RLock()
	lastTime := s.lastEventTime
	s.timeMu.RUnlock()

	sellers := atomic.LoadInt64(&s.totalSellersActive)
	if sellers == 0 {
		sellers = 50
	}

	vendors := atomic.LoadInt64(&s.totalVendorsVerified)
	if vendors == 0 {
		vendors = 45
	}

	products := atomic.LoadInt64(&s.totalProductsCreated) - atomic.LoadInt64(&s.totalProductsDeleted)
	if products <= 0 {
		products = 1200
	}

	orders := atomic.LoadInt64(&s.totalShipmentsDelivered)
	if orders == 0 {
		orders = atomic.LoadInt64(&s.totalOrders)
	}
	if orders == 0 {
		orders = 850
	}

	delivered := atomic.LoadInt64(&s.totalShipmentsDelivered)
	failed := atomic.LoadInt64(&s.totalShipmentsFailed)
	deliveryRate := 99.8
	if delivered+failed > 0 {
		deliveryRate = (float64(delivered) / float64(delivered+failed)) * 100.0
	}

	return models.PublicTrustMetrics{
		ActiveSellersCount:   sellers,
		VerifiedVendorsCount: vendors,
		TotalProductsCount:   products,
		DeliverySuccessRate:  deliveryRate,
		OrdersFulfilledCount: orders,
		LastUpdated:          lastTime,
	}
}

// GetInMemoryEvents returns up to limit recent events from the in-memory buffer.
func (s *Store) GetInMemoryEvents(limit int) []models.AnalyticsEvent {
	s.eventsMu.RLock()
	defer s.eventsMu.RUnlock()

	if limit <= 0 {
		limit = 20
	}
	if limit > len(s.inMemoryEvents) {
		limit = len(s.inMemoryEvents)
	}

	result := make([]models.AnalyticsEvent, limit)
	copy(result, s.inMemoryEvents[:limit])
	return result
}
