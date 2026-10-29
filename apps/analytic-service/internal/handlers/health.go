package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/cache"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/db"
)

// HealthHandler serves liveness, readiness, and overall health status.
type HealthHandler struct {
	db        *db.Database
	redis     *cache.RedisClient
	startTime time.Time
}

// NewHealthHandler creates a HealthHandler instance.
func NewHealthHandler(database *db.Database, r *cache.RedisClient) *HealthHandler {
	return &HealthHandler{
		db:        database,
		redis:     r,
		startTime: time.Now(),
	}
}

// Check returns aggregated health status.
func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	pgStatus := "healthy"
	if h.db == nil || h.db.Ping(ctx) != nil {
		pgStatus = "degraded"
	}

	redisStatus := "healthy"
	if h.redis == nil || h.redis.Ping(ctx) != nil {
		redisStatus = "degraded"
	}

	status := "healthy"
	if pgStatus == "degraded" {
		status = "degraded"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    status,
		"service":   "analytic-service",
		"version":   "1.0.0",
		"uptimeSec": int(time.Since(h.startTime).Seconds()),
		"dependencies": map[string]string{
			"postgres": pgStatus,
			"redis":    redisStatus,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// Live is the Kubernetes liveness probe.
func (h *HealthHandler) Live(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

// Ready is the Kubernetes readiness probe.
func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if h.db != nil && h.db.Ping(ctx) != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("DATABASE_UNAVAILABLE"))
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("READY"))
}
