package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	EventsConsumedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "analytics_events_consumed_total",
			Help: "Total count of Kafka events consumed by analytic-service",
		},
		[]string{"event_type"},
	)

	BatchEventsFlushedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "analytics_batch_events_flushed_total",
			Help: "Total number of analytics events flushed to PostgreSQL",
		},
	)

	BatchFlushDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "analytics_batch_flush_duration_seconds",
			Help:    "Duration in seconds of bulk database copy-from operations",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
		},
	)

	QueueLength = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "analytics_queue_length",
			Help: "Current count of telemetry events buffered in memory awaiting batch flush",
		},
	)

	HttpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route", "status_code"},
	)

	CacheHitsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total cache hits",
		},
		[]string{"cache_type"},
	)

	CacheMissesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total cache misses",
		},
		[]string{"cache_type"},
	)

	CacheErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_errors_total",
			Help: "Total cache errors",
		},
		[]string{"cache_type"},
	)
)
