package db

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClickHouseClient(t *testing.T) {
	// Mock ClickHouse HTTP Server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ping" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("Ok.\n"))
			return
		}

		// Query execution endpoint
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"meta": [{"name": "date_str", "type": "String"}, {"name": "total_revenue", "type": "Float64"}, {"name": "total_events", "type": "UInt64"}],
			"data": [
				{"date_str": "2026-10-30", "total_revenue": 1500.50, "total_events": 10}
			],
			"rows": 1
		}`))
	}))
	defer server.Close()

	ch, err := NewClickHouseClient(server.URL + "/analytics_db")
	if err != nil {
		t.Fatalf("failed to initialize clickhouse client: %v", err)
	}

	ctx := context.Background()

	// 1. Test Ping
	if err := ch.Ping(ctx); err != nil {
		t.Errorf("expected successful ping, got: %v", err)
	}

	// 2. Test GetDailyAnalytics
	analytics, err := ch.GetDailyAnalytics(ctx, 7)
	if err != nil {
		t.Fatalf("expected successful daily analytics, got: %v", err)
	}
	if len(analytics) != 1 {
		t.Fatalf("expected 1 analytics entry, got %d", len(analytics))
	}
	if analytics[0].TotalRevenue != 1500.50 {
		t.Errorf("expected 1500.50 revenue, got %.2f", analytics[0].TotalRevenue)
	}
	if analytics[0].TotalOrders != 10 {
		t.Errorf("expected 10 orders, got %d", analytics[0].TotalOrders)
	}
}

