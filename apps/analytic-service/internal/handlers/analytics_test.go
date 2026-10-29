package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/metrics"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
)

func TestAnalyticsHandlerEndpoints(t *testing.T) {
	store := metrics.NewStore()
	uid := "user_handler_test"
	store.RecordEvent("payment.successful", &uid, 120.00, map[string]interface{}{"orderId": "o_test"}, time.Now())

	handler := NewAnalyticsHandler(nil, nil, store, 60*time.Second, 15*time.Second)

	// 1. Test GET /analytics/summary
	reqSummary := httptest.NewRequest("GET", "/analytics/summary", nil)
	recSummary := httptest.NewRecorder()
	handler.GetSummary(recSummary, reqSummary)

	if recSummary.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recSummary.Code)
	}

	var summary models.AnalyticsSummary
	if err := json.Unmarshal(recSummary.Body.Bytes(), &summary); err != nil {
		t.Fatalf("failed to unmarshal summary response: %v", err)
	}
	if summary.TotalRevenue != 120.00 {
		t.Errorf("expected 120.00 totalRevenue, got %.2f", summary.TotalRevenue)
	}
	if summary.TotalOrders != 1 {
		t.Errorf("expected 1 totalOrder, got %d", summary.TotalOrders)
	}

	// 2. Test GET /analytics/merchants
	reqMerchants := httptest.NewRequest("GET", "/analytics/merchants", nil)
	recMerchants := httptest.NewRecorder()
	handler.GetMerchants(recMerchants, reqMerchants)

	if recMerchants.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recMerchants.Code)
	}

	// 3. Test GET /analytics/daily-chart (fallback to in-memory)
	reqChart := httptest.NewRequest("GET", "/analytics/daily-chart?days=7", nil)
	recChart := httptest.NewRecorder()
	handler.GetDailyChart(recChart, reqChart)

	if recChart.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recChart.Code)
	}
	var chart []models.AnalyticsDailyChart
	if err := json.Unmarshal(recChart.Body.Bytes(), &chart); err != nil {
		t.Fatalf("failed to unmarshal daily chart: %v", err)
	}
	if len(chart) == 0 {
		t.Errorf("expected at least 1 day chart entry")
	}

	// 4. Test GET /analytics/events
	reqEvents := httptest.NewRequest("GET", "/analytics/events?limit=5", nil)
	recEvents := httptest.NewRecorder()
	handler.GetRecentEvents(recEvents, reqEvents)

	if recEvents.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recEvents.Code)
	}

	// 5. Test GET /analytics/operations
	reqOps := httptest.NewRequest("GET", "/analytics/operations", nil)
	recOps := httptest.NewRecorder()
	handler.GetOperations(recOps, reqOps)

	if recOps.Code != http.StatusOK {
		t.Fatalf("expected status 200 for operations, got %d", recOps.Code)
	}

	// 6. Test GET /analytics/commerce
	reqComm := httptest.NewRequest("GET", "/analytics/commerce", nil)
	recComm := httptest.NewRecorder()
	handler.GetCommerce(recComm, reqComm)

	if recComm.Code != http.StatusOK {
		t.Fatalf("expected status 200 for commerce, got %d", recComm.Code)
	}

	// 7. Test GET /analytics/public
	reqPublic := httptest.NewRequest("GET", "/analytics/public", nil)
	recPublic := httptest.NewRecorder()
	handler.GetPublicMetrics(recPublic, reqPublic)

	if recPublic.Code != http.StatusOK {
		t.Fatalf("expected status 200 for public metrics, got %d", recPublic.Code)
	}
}
