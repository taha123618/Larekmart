package consumers

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/segmentio/kafka-go"
)

// ConsumerManager coordinates background Kafka readers for configured topics.
type ConsumerManager struct {
	brokers []string
	groupID string
	topics  []string
	handler *DomainEventHandler
	logger  *observability.Logger
	readers []*kafka.Reader
	wg      sync.WaitGroup
	cancel  context.CancelFunc
}

func NewConsumerManager(
	brokers []string,
	groupID string,
	topics []string,
	handler *DomainEventHandler,
	logger *observability.Logger,
) *ConsumerManager {
	return &ConsumerManager{
		brokers: brokers,
		groupID: groupID,
		topics:  topics,
		handler: handler,
		logger:  logger,
	}
}

// Start launches a background goroutine reader for each subscribed topic.
func (m *ConsumerManager) Start(ctx context.Context) {
	consumerCtx, cancel := context.WithCancel(ctx)
	m.cancel = cancel

	for _, topic := range m.topics {
		reader := kafka.NewReader(kafka.ReaderConfig{
			Brokers:        m.brokers,
			GroupID:        m.groupID,
			Topic:          topic,
			MinBytes:       10e3, // 10KB
			MaxBytes:       10e6, // 10MB
			CommitInterval: time.Second,
			StartOffset:    kafka.FirstOffset, // tolerant of new consumer group replays
		})
		m.readers = append(m.readers, reader)

		m.wg.Add(1)
		go m.consumeLoop(consumerCtx, reader, topic)
	}

	m.logger.Info(ctx, fmt.Sprintf("Kafka Consumer Manager started for %d topic(s)", len(m.topics)), map[string]interface{}{
		"topics":   m.topics,
		"group_id": m.groupID,
	})
}

func (m *ConsumerManager) consumeLoop(ctx context.Context, reader *kafka.Reader, topic string) {
	defer m.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		default:
			msg, err := reader.FetchMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				m.logger.Warn(ctx, fmt.Sprintf("Kafka read warning on topic '%s'", topic), map[string]interface{}{
					"error": err.Error(),
				})
				time.Sleep(500 * time.Millisecond)
				continue
			}

			// Process event
			processErr := m.handler.HandleEvent(ctx, topic, msg.Key, msg.Value)
			if processErr != nil {
				m.logger.Error(ctx, fmt.Sprintf("Error processing message from topic '%s'", topic), processErr, map[string]interface{}{
					"offset":    msg.Offset,
					"partition": msg.Partition,
				})
			}

			// Commit offset
			if commitErr := reader.CommitMessages(ctx, msg); commitErr != nil {
				m.logger.Warn(ctx, fmt.Sprintf("Failed to commit offset on topic '%s'", topic), map[string]interface{}{
					"offset": msg.Offset,
					"error":  commitErr.Error(),
				})
			}
		}
	}
}

// Close gracefully stops all readers and waits for loops to exit.
func (m *ConsumerManager) Close() error {
	if m.cancel != nil {
		m.cancel()
	}

	for _, reader := range m.readers {
		_ = reader.Close()
	}

	m.wg.Wait()
	m.logger.Info(context.Background(), "Kafka Consumer Manager stopped cleanly")
	return nil
}
