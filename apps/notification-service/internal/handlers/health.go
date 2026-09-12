package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

var startTime = time.Now()

type CheckResult struct {
	Status    string `json:"status"` // healthy, degraded, unhealthy
	LatencyMS int64  `json:"latencyMs"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

type HealthResponse struct {
	Service       string                 `json:"service"`
	Status        string                 `json:"status"` // healthy, degraded, unhealthy
	UptimeSeconds int64                  `json:"uptimeSeconds"`
	Timestamp     string                 `json:"timestamp"`
	Version       string                 `json:"version"`
	Checks        map[string]CheckResult `json:"checks"`
	Summary       map[string]int         `json:"summary"`
}

func HealthHandler(db *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		checks := make(map[string]CheckResult)
		overallStatus := "healthy"
		healthyCount := 0
		unhealthyCount := 0

		// 1. PostgreSQL Check
		dbStart := time.Now()
		var dbRes CheckResult
		if err := db.Ping(ctx); err != nil {
			dbRes = CheckResult{
				Status:    "unhealthy",
				LatencyMS: time.Since(dbStart).Milliseconds(),
				Message:   "PostgreSQL connection failed: " + err.Error(),
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			overallStatus = "unhealthy"
			unhealthyCount++
		} else {
			dbRes = CheckResult{
				Status:    "healthy",
				LatencyMS: time.Since(dbStart).Milliseconds(),
				Message:   "PostgreSQL ping successful",
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			healthyCount++
		}
		checks["postgres"] = dbRes

		// 2. Redis Check
		if rdb != nil {
			redisStart := time.Now()
			var redisRes CheckResult
			if err := rdb.Ping(ctx).Err(); err != nil {
				redisRes = CheckResult{
					Status:    "degraded",
					LatencyMS: time.Since(redisStart).Milliseconds(),
					Message:   "Redis ping failed: " + err.Error(),
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				}
				if overallStatus != "unhealthy" {
					overallStatus = "degraded"
				}
				unhealthyCount++
			} else {
				redisRes = CheckResult{
					Status:    "healthy",
					LatencyMS: time.Since(redisStart).Milliseconds(),
					Message:   "Redis ping successful",
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				}
				healthyCount++
			}
			checks["redis"] = redisRes
		}

		response := HealthResponse{
			Service:       "notification-service",
			Status:        overallStatus,
			UptimeSeconds: int64(time.Since(startTime).Seconds()),
			Timestamp:     time.Now().UTC().Format(time.RFC3339),
			Version:       "1.0.0",
			Checks:        checks,
			Summary: map[string]int{
				"total":     len(checks),
				"healthy":   healthyCount,
				"degraded":  0,
				"unhealthy": unhealthyCount,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		if overallStatus == "unhealthy" {
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			w.WriteHeader(http.StatusOK)
		}
		_ = json.NewEncoder(w).Encode(response)
	}
}

func ReadyHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}
}
