package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/metrics"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
)

var SubscribedTopics = []string{
	"payment.successful",
	"payment-successful",
	"order.created",
	"order-successful",
	"user.created",
	"user.registered",
	"email-successful",
	"product.created",
	"product.deleted",
	"inventory.stock.sold",
	"inventory.low_stock",
	"inventory.restocked",
	"cart.created",
	"cart.updated",
	"cart.merged",
	"cart.expired",
	"cart.cleared",
	"media.uploaded",
	"media.processed",
	"media.deleted",
	"review.created",
	"review.updated",
	"review.deleted",
	"wishlist.item_added",
	"wishlist.item_removed",
	"wishlist.cleared",
	"promotion.coupon_applied",
	"promotion.discount_applied",
	"promotion.campaign_created",
	"tax.calculated",
	"tax.quote_created",
	"tax.exempted",
	"return.requested",
	"return.inspected",
	"return.completed",
	"return.rejected",
	"vendor.registered",
	"vendor.verified",
	"vendor.suspended",
	"seller.created",
	"seller.activated",
	"seller.suspended",
}

// KafkaConsumer coordinates continuous topic consumption without event-loop starvation.
type KafkaConsumer struct {
	reader  *kafka.Reader
	store   *metrics.Store
	batcher *EventBatcher
	cancel  context.CancelFunc
	wg      sync.WaitGroup
}

// NewKafkaConsumer initializes a segmentio/kafka-go reader subscribing to all domain streams.
func NewKafkaConsumer(brokers []string, groupID string, store *metrics.Store, batcher *EventBatcher) *KafkaConsumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		GroupID:        groupID,
		GroupTopics:    SubscribedTopics,
		MinBytes:       10e3, // 10KB
		MaxBytes:       10e6, // 10MB
		CommitInterval: 1 * time.Second,
		StartOffset:    kafka.LastOffset,
	})

	return &KafkaConsumer{
		reader:  reader,
		store:   store,
		batcher: batcher,
	}
}

// Start launches the dedicated goroutine reader loop.
func (c *KafkaConsumer) Start(ctx context.Context) {
	loopCtx, cancel := context.WithCancel(ctx)
	c.cancel = cancel

	c.wg.Add(1)
	go c.consumeLoop(loopCtx)

	log.Info("KafkaConsumer background ingestion loop started", map[string]interface{}{
		"topicsCount": len(SubscribedTopics),
	})
}

func (c *KafkaConsumer) consumeLoop(ctx context.Context) {
	defer c.wg.Done()

	for {
		select {
		case <-ctx.Done():
			log.Info("Kafka consumer loop shutting down")
			return
		default:
		}

		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Warn("Kafka fetch message error (retrying):", map[string]interface{}{"error": err.Error()})
			time.Sleep(200 * time.Millisecond)
			continue
		}

		c.processMessage(msg)

		// Commit offset cleanly
		_ = c.reader.CommitMessages(ctx, msg)
	}
}

func (c *KafkaConsumer) processMessage(msg kafka.Message) {
	observability.EventsConsumedTotal.WithLabelValues(msg.Topic).Inc()

	var envelope struct {
		Value json.RawMessage `json:"value"`
	}

	raw := msg.Value
	var payloadBytes []byte

	// Unpack { value: ... } envelope convention
	if err := json.Unmarshal(raw, &envelope); err == nil && len(envelope.Value) > 0 {
		payloadBytes = envelope.Value
	} else {
		payloadBytes = raw
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &parsed); err != nil {
		parsed = map[string]interface{}{"raw": string(payloadBytes)}
	}

	userID := extractUserID(parsed)
	amount := extractAmount(parsed)
	createdAt := msg.Time
	if createdAt.IsZero() {
		createdAt = time.Now()
	}

	// 1. Instantly update lock-free in-memory KPI counters
	c.store.RecordEvent(msg.Topic, userID, amount, parsed, createdAt)

	// 2. Enqueue to high-throughput batcher channel
	c.batcher.Enqueue(models.BufferedAnalyticsEvent{
		EventType: msg.Topic,
		UserID:    userID,
		Amount:    &amount,
		Metadata:  parsed,
		CreatedAt: createdAt,
	})
}

func extractUserID(payload map[string]interface{}) *string {
	keys := []string{"userId", "user_id", "vendorId", "sellerId", "customer_id"}
	for _, k := range keys {
		if val, exists := payload[k]; exists && val != nil {
			str := fmt.Sprintf("%v", val)
			return &str
		}
	}
	return nil
}

func extractAmount(payload map[string]interface{}) float64 {
	keys := []string{"amount", "total", "price", "revenue", "tax_amount"}
	for _, k := range keys {
		if val, exists := payload[k]; exists && val != nil {
			switch num := val.(type) {
			case float64:
				return num
			case int:
				return float64(num)
			case int64:
				return float64(num)
			}
		}
	}
	return 0.0
}

// Close gracefully terminates the consumer reader and awaits completion.
func (c *KafkaConsumer) Close() error {
	if c.cancel != nil {
		c.cancel()
	}
	c.wg.Wait()
	if c.reader != nil {
		return c.reader.Close()
	}
	return nil
}
