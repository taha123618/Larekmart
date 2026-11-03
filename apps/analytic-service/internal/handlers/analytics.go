package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/cache"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/db"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/metrics"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
)

var log = observability.NewLogger("analytic-service:handlers")

// AnalyticsHandler handles admin analytics HTTP routes.
type AnalyticsHandler struct {
	db             *db.Database
	clickhouse     *db.ClickHouseClient
	redis          *cache.RedisClient
	store          *metrics.Store
	chartCacheTTL  time.Duration
	eventsCacheTTL time.Duration
}

// NewAnalyticsHandler creates an AnalyticsHandler instance.
func NewAnalyticsHandler(database *db.Database, ch *db.ClickHouseClient, r *cache.RedisClient, s *metrics.Store, chartTTL, eventsTTL time.Duration) *AnalyticsHandler {
	return &AnalyticsHandler{
		db:             database,
		clickhouse:     ch,
		redis:          r,
		store:          s,
		chartCacheTTL:  chartTTL,
		eventsCacheTTL: eventsTTL,
	}
}

// GetSummary returns real-time high-level platform KPI summary.
func (h *AnalyticsHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	isDbConnected := false
	if h.db != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 1*time.Second)
		defer cancel()
		if err := h.db.Ping(ctx); err == nil {
			isDbConnected = true
		}
	}

	summary := h.store.GetSummary(isDbConnected)
	writeJSON(w, http.StatusOK, summary)
}

// GetMerchants returns merchant & vendor ecosystem statistics.
func (h *AnalyticsHandler) GetMerchants(w http.ResponseWriter, r *http.Request) {
	metrics := h.store.GetMerchantMetrics()
	writeJSON(w, http.StatusOK, metrics)
}

// GetOperations returns fulfillment, inventory, shipping, and returns operations telemetry.
func (h *AnalyticsHandler) GetOperations(w http.ResponseWriter, r *http.Request) {
	metrics := h.store.GetOperationsMetrics()
	writeJSON(w, http.StatusOK, metrics)
}

// GetCommerce returns financial, promotional, tax, and checkout conversion telemetry.
func (h *AnalyticsHandler) GetCommerce(w http.ResponseWriter, r *http.Request) {
	metrics := h.store.GetCommerceMetrics()
	writeJSON(w, http.StatusOK, metrics)
}

// GetPublicMetrics returns public platform trust and social proof metrics (no auth required).
func (h *AnalyticsHandler) GetPublicMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := h.store.GetPublicTrustMetrics()
	writeJSON(w, http.StatusOK, metrics)
}

// GetDailyChart returns historical daily aggregations with Redis caching.
func (h *AnalyticsHandler) GetDailyChart(w http.ResponseWriter, r *http.Request) {
	days := 30
	if daysParam := r.URL.Query().Get("days"); daysParam != "" {
		if val, err := strconv.Atoi(daysParam); err == nil && val > 0 {
			days = val
		}
	}

	ctx := r.Context()

	// 1. Check Redis cache
	if chart, found := h.redis.GetDailyChart(ctx, days); found {
		writeJSON(w, http.StatusOK, chart)
		return
	}

	// 2. Query ClickHouse first (Columnar vectorization), fallback to PostgreSQL
	var result []models.AnalyticsDailyChart
	if h.clickhouse != nil {
		chCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		var err error
		result, err = h.clickhouse.GetDailyAnalytics(chCtx, days)
		cancel()
		if err != nil {
			log.Warn("Failed to query daily analytics from ClickHouse; falling back to PostgreSQL", map[string]interface{}{"error": err.Error()})
		}
	}

	if len(result) == 0 && h.db != nil {
		dbCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		var err error
		result, err = h.db.GetDailyAnalytics(dbCtx, days)
		cancel()
		if err != nil {
			log.Warn("Failed to query daily analytics from database", map[string]interface{}{"error": err.Error()})
		}
	}

	// 3. Fallback to today's in-memory snapshot if DB had no rows or was offline
	if len(result) == 0 {
		todayStr := time.Now().UTC().Format("2006-01-02")
		snap := h.store.GetSummary(false)
		result = []models.AnalyticsDailyChart{
			{
				Date:                 todayStr,
				TotalRevenue:         snap.TotalRevenue,
				TotalOrders:          snap.TotalOrders,
				TotalSignups:         snap.TotalSignups,
				TotalProductsCreated: snap.TotalProductsCreated,
			},
		}
	}

	// 4. Cache in Redis
	h.redis.SetDailyChart(ctx, days, result, h.chartCacheTTL)

	writeJSON(w, http.StatusOK, result)
}

// GetRecentEvents returns the recent audit event stream with Redis caching.
func (h *AnalyticsHandler) GetRecentEvents(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if limitParam := r.URL.Query().Get("limit"); limitParam != "" {
		if val, err := strconv.Atoi(limitParam); err == nil && val > 0 {
			limit = val
		}
	}

	ctx := r.Context()

	// 1. Check Redis cache
	if events, found := h.redis.GetRecentEvents(ctx, limit); found {
		writeJSON(w, http.StatusOK, events)
		return
	}

	// 2. Query ClickHouse first (Columnar vectorization), fallback to PostgreSQL
	var events []models.AnalyticsEvent
	if h.clickhouse != nil {
		chCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		var err error
		events, err = h.clickhouse.GetRecentEvents(chCtx, limit)
		cancel()
		if err != nil {
			log.Warn("Failed to query recent events from ClickHouse; falling back to PostgreSQL", map[string]interface{}{"error": err.Error()})
		}
	}

	if len(events) == 0 && h.db != nil {
		dbCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		var err error
		events, err = h.db.GetRecentEvents(dbCtx, limit)
		cancel()
		if err != nil {
			log.Warn("Failed to query recent events from database", map[string]interface{}{"error": err.Error()})
		}
	}

	// 3. Fallback to in-memory events if DB had no events or was offline
	if len(events) == 0 {
		events = h.store.GetInMemoryEvents(limit)
	}

	// 4. Cache in Redis
	h.redis.SetRecentEvents(ctx, limit, events, h.eventsCacheTTL)

	writeJSON(w, http.StatusOK, events)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
