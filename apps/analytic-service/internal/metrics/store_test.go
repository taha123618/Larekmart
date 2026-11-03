package metrics

import (
	"sync"
	"testing"
	"time"
)

func TestStoreAtomicCounters(t *testing.T) {
	s := NewStore()

	// 1. Initial snapshot
	snap := s.GetSummary(true)
	if snap.TotalRevenue != 0 || snap.TotalOrders != 0 || snap.TotalSignups != 0 {
		t.Errorf("expected clean initial state, got %+v", snap)
	}

	// 2. Concurrently record events
	var wg sync.WaitGroup
	workers := 10
	eventsPerWorker := 100

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < eventsPerWorker; j++ {
				uid := "user_test"
				s.RecordEvent("payment.successful", &uid, 25.50, map[string]interface{}{"orderId": "o_123"}, time.Now())
				s.RecordEvent("user.created", &uid, 0, nil, time.Now())
				s.RecordEvent("vendor.registered", &uid, 0, nil, time.Now())
			}
		}()
	}

	wg.Wait()

	snap = s.GetSummary(true)
	expectedOrders := int64(workers * eventsPerWorker)
	expectedSignups := int64(workers * eventsPerWorker)
	expectedRevenue := float64(workers*eventsPerWorker) * 25.50

	if snap.TotalOrders != expectedOrders {
		t.Errorf("expected %d orders, got %d", expectedOrders, snap.TotalOrders)
	}
	if snap.TotalSignups != expectedSignups {
		t.Errorf("expected %d signups, got %d", expectedSignups, snap.TotalSignups)
	}
	if snap.TotalRevenue != expectedRevenue {
		t.Errorf("expected %.2f revenue, got %.2f", expectedRevenue, snap.TotalRevenue)
	}

	merchantSnap := s.GetMerchantMetrics()
	if merchantSnap.TotalVendorsRegistered != int64(workers*eventsPerWorker) {
		t.Errorf("expected %d vendors, got %d", workers*eventsPerWorker, merchantSnap.TotalVendorsRegistered)
	}

	// 3. Ring buffer holds up to 100 events
	events := s.GetInMemoryEvents(50)
	if len(events) != 50 {
		t.Errorf("expected 50 recent events, got %d", len(events))
	}

	// 4. Test Operations & Commerce & Public Trust metrics
	uid := "user_test"
	s.RecordEvent("shipment.delivered", &uid, 12.0, nil, time.Now())
	s.RecordEvent("return.completed", &uid, 50.0, nil, time.Now())
	s.RecordEvent("promotion.discount_applied", &uid, 15.0, nil, time.Now())

	ops := s.GetOperationsMetrics()
	if ops.TotalShipmentsDelivered != 1 {
		t.Errorf("expected 1 shipment delivered, got %d", ops.TotalShipmentsDelivered)
	}
	if ops.TotalReturnsCompleted != 1 {
		t.Errorf("expected 1 return completed, got %d", ops.TotalReturnsCompleted)
	}
	if ops.TotalRefundAmount != 50.0 {
		t.Errorf("expected 50.0 refund, got %.2f", ops.TotalRefundAmount)
	}

	commerce := s.GetCommerceMetrics()
	if commerce.TotalDiscountsApplied != 1 {
		t.Errorf("expected 1 discount applied, got %d", commerce.TotalDiscountsApplied)
	}
	if commerce.TotalDiscountSavings != 15.0 {
		t.Errorf("expected 15.0 discount savings, got %.2f", commerce.TotalDiscountSavings)
	}

	trust := s.GetPublicTrustMetrics()
	if trust.DeliverySuccessRate <= 0 {
		t.Errorf("expected valid delivery rate, got %.2f", trust.DeliverySuccessRate)
	}
}
