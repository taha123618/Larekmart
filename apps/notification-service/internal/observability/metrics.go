package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds Prometheus metric collectors for notification-service.
type Metrics struct {
	EventsConsumedTotal   *prometheus.CounterVec
	NotificationsCreated  *prometheus.CounterVec
	DeliveriesTotal       *prometheus.CounterVec
	DeliveryDuration      *prometheus.HistogramVec
	ActiveWSConnections   prometheus.Gauge
	WorkerQueueDepth      *prometheus.GaugeVec
	DeduplicationHits     prometheus.Counter
	IdempotencyDuplicates prometheus.Counter
}

// NewMetrics initializes and registers all Prometheus metrics.
func NewMetrics(namespace string) *Metrics {
	return &Metrics{
		EventsConsumedTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "events_consumed_total",
				Help:      "Total number of domain events consumed from Kafka",
			},
			[]string{"topic", "status"},
		),
		NotificationsCreated: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "notifications_created_total",
				Help:      "Total notifications resolved and created",
			},
			[]string{"type", "priority"},
		),
		DeliveriesTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "deliveries_total",
				Help:      "Total notification delivery attempts",
			},
			[]string{"channel", "status"},
		),
		DeliveryDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "delivery_duration_seconds",
				Help:      "Latency of notification delivery per channel",
				Buckets:   []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
			},
			[]string{"channel", "status"},
		),
		ActiveWSConnections: promauto.NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "active_websocket_connections",
				Help:      "Current active in-app WebSocket client connections",
			},
		),
		WorkerQueueDepth: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "worker_queue_depth",
				Help:      "Current number of pending jobs in channel worker pools",
			},
			[]string{"channel"},
		),
		DeduplicationHits: promauto.NewCounter(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "deduplication_hits_total",
				Help:      "Total duplicate events suppressed by Redis fast-cache",
			},
		),
		IdempotencyDuplicates: promauto.NewCounter(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "idempotency_duplicates_total",
				Help:      "Total duplicate events blocked by database idempotency log",
			},
		),
	}
}
