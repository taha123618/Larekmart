package ingestion

import (
	"context"
	"sync"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/db"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
)

var log = observability.NewLogger("analytic-service:batcher")

// EventBatcher coordinates high-throughput in-memory buffering and bulk database persistence.
type EventBatcher struct {
	db            *db.Database
	ch            *db.ClickHouseClient
	queue         chan models.BufferedAnalyticsEvent
	maxBatchSize  int
	flushInterval time.Duration
	stopChan      chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
}

// NewBatcher creates an EventBatcher with specified batch size and flush interval.
func NewBatcher(database *db.Database, clickhouseClient *db.ClickHouseClient, maxBatchSize int, flushInterval time.Duration, queueCapacity int) *EventBatcher {
	if maxBatchSize <= 0 {
		maxBatchSize = 10000
	}
	if flushInterval <= 0 {
		flushInterval = 500 * time.Millisecond
	}
	if queueCapacity <= 0 {
		queueCapacity = 50000
	}

	return &EventBatcher{
		db:            database,
		ch:            clickhouseClient,
		queue:         make(chan models.BufferedAnalyticsEvent, queueCapacity),
		maxBatchSize:  maxBatchSize,
		flushInterval: flushInterval,
		stopChan:      make(chan struct{}),
	}
}

// Start spawns the background worker collecting events and flushing micro-batches.
func (b *EventBatcher) Start() {
	b.mu.Lock()
	if b.running {
		b.mu.Unlock()
		return
	}
	b.running = true
	b.mu.Unlock()

	b.wg.Add(1)
	go b.flushLoop()

	log.Info("EventBatcher started", map[string]interface{}{
		"maxBatchSize":  b.maxBatchSize,
		"flushInterval": b.flushInterval.String(),
		"queueCapacity": cap(b.queue),
	})
}

// Enqueue adds a telemetry event to the buffered channel without blocking the caller.
func (b *EventBatcher) Enqueue(event models.BufferedAnalyticsEvent) bool {
	select {
	case b.queue <- event:
		observability.QueueLength.Set(float64(len(b.queue)))
		return true
	default:
		// Queue full - log warning to preserve event-loop responsiveness
		log.Warn("EventBatcher queue buffer saturated; dropping event to preserve stability", map[string]interface{}{
			"eventType": event.EventType,
			"queueLen":  len(b.queue),
		})
		return false
	}
}

// QueueLength returns the current number of queued events.
func (b *EventBatcher) QueueLength() int {
	return len(b.queue)
}

func (b *EventBatcher) flushLoop() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	batch := make([]models.BufferedAnalyticsEvent, 0, b.maxBatchSize)

	for {
		select {
		case <-b.stopChan:
			// Drain remaining events in channel
			for {
				select {
				case evt := <-b.queue:
					batch = append(batch, evt)
					if len(batch) >= b.maxBatchSize {
						b.flushBatch(batch)
						batch = make([]models.BufferedAnalyticsEvent, 0, b.maxBatchSize)
					}
				default:
					if len(batch) > 0 {
						b.flushBatch(batch)
					}
					return
				}
			}

		case evt := <-b.queue:
			batch = append(batch, evt)
			observability.QueueLength.Set(float64(len(b.queue)))
			if len(batch) >= b.maxBatchSize {
				b.flushBatch(batch)
				batch = make([]models.BufferedAnalyticsEvent, 0, b.maxBatchSize)
				ticker.Reset(b.flushInterval)
			}

		case <-ticker.C:
			if len(batch) > 0 {
				b.flushBatch(batch)
				batch = make([]models.BufferedAnalyticsEvent, 0, b.maxBatchSize)
			}
		}
	}
}

func (b *EventBatcher) flushBatch(batch []models.BufferedAnalyticsEvent) {
	if len(batch) == 0 {
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var count int64
	var rawIngestErr error

	// 1. PRIMARY ANALYTICS INGESTION: Columnar ClickHouse Warehouse
	// ClickHouse is the dedicated, authoritative store for raw unaggregated high-velocity stream frames.
	// When ClickHouse is active, we bypass writing raw event rows to PostgreSQL, eliminating dual-write
	// amplification and RAM heap inflation under flash-sale traffic storms.
	if b.ch != nil {
		count, rawIngestErr = b.ch.InsertEventsBatch(ctx, batch)
		if rawIngestErr != nil {
			log.Warn("ClickHouse micro-batch ingestion failed; failing over to PostgreSQL raw event ingestion:", map[string]interface{}{
				"error": rawIngestErr.Error(),
				"count": len(batch),
			})
			if b.db != nil {
				count, _ = b.db.CopyFromEvents(ctx, batch)
			}
		}
	} else if b.db != nil {
		// Resilient fallback: write raw events to PostgreSQL only when ClickHouse is unconfigured
		count, rawIngestErr = b.db.CopyFromEvents(ctx, batch)
		if rawIngestErr != nil {
			log.Error("Failed to flush batch of events to PostgreSQL", map[string]interface{}{
				"error": rawIngestErr.Error(),
				"count": len(batch),
			})
			return
		}
	} else {
		log.Warn("No database target available; skipping batch persistence", map[string]interface{}{"count": len(batch)})
		return
	}

	duration := time.Since(start).Seconds()
	observability.BatchFlushDuration.Observe(duration)
	observability.BatchEventsFlushedTotal.Add(float64(count))

	// 2. RELATIONAL OPERATIONAL LAYER: Low-velocity aggregated KPI snapshots in PostgreSQL
	// PostgreSQL only stores pre-aggregated daily summaries (revenue, orders, signups, products).
	// This reduces relational write I/O by >99% compared to raw per-event insertions.
	if b.db != nil {
		var revenue float64
		var orders, signups, products int64

		for _, e := range batch {
			switch e.EventType {
			case "payment.successful", "payment-successful":
				if e.Amount != nil {
					revenue += *e.Amount
				}
				orders++
			case "order.created", "order-successful":
				orders++
			case "user.created", "user.registered", "email-successful":
				signups++
			case "product.created":
				products++
			}
		}

		if orders > 0 || revenue > 0 || signups > 0 || products > 0 {
			_ = b.db.IncrementDailySummary(ctx, revenue, orders, signups, products)
		}
	}

	log.Info("Successfully flushed batch of analytics events", map[string]interface{}{
		"count":       len(batch),
		"persisted":   count,
		"durationSec": duration,
	})
}

// Stop gracefully drains the channel queue and executes a final flush.
func (b *EventBatcher) Stop() {
	b.mu.Lock()
	if !b.running {
		b.mu.Unlock()
		return
	}
	b.running = false
	close(b.stopChan)
	b.mu.Unlock()

	b.wg.Wait()
	log.Info("EventBatcher stopped cleanly")
}
