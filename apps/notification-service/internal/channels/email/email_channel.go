package email

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/segmentio/kafka-go"
)

type EmailChannel struct {
	kafkaWriter *kafka.Writer
	logger      *observability.Logger
	enabled     bool
}

func NewEmailChannel(brokers []string, topic string, enabled bool, logger *observability.Logger) *EmailChannel {
	var writer *kafka.Writer
	if len(brokers) > 0 && brokers[0] != "" {
		writer = &kafka.Writer{
			Addr:     kafka.TCP(brokers...),
			Topic:    topic,
			Balancer: &kafka.LeastBytes{},
		}
	}
	return &EmailChannel{
		kafkaWriter: writer,
		logger:      logger,
		enabled:     enabled,
	}
}

func (c *EmailChannel) Name() models.ChannelType {
	return models.ChannelEmail
}

func (c *EmailChannel) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	if !c.enabled {
		c.logger.Info(ctx, "Email channel is disabled, skipping delivery", map[string]interface{}{
			"recipient": delivery.Recipient,
		})
		return nil
	}

	c.logger.Info(ctx, fmt.Sprintf("Dispatching email notification to %s", delivery.Recipient), map[string]interface{}{
		"notification_id": n.ID,
		"delivery_id":     delivery.ID,
		"subject":         n.Title,
	})

	// If Kafka writer is configured, publish to email dispatch topic
	if c.kafkaWriter != nil {
		payload := map[string]interface{}{
			"email":   delivery.Recipient,
			"subject": n.Title,
			"text":    n.Body,
			"html":    n.Metadata["html_body"],
			"context": n.Metadata,
		}

		envelope := models.KafkaEnvelope{Value: payload}
		data, err := json.Marshal(envelope)
		if err != nil {
			return fmt.Errorf("failed to marshal email event payload: %w", err)
		}

		err = c.kafkaWriter.WriteMessages(ctx, kafka.Message{
			Key:   []byte(n.UserID),
			Value: data,
		})
		if err != nil {
			return fmt.Errorf("failed to write email message to Kafka: %w", err)
		}
	}

	return nil
}

func (c *EmailChannel) Close() error {
	if c.kafkaWriter != nil {
		return c.kafkaWriter.Close()
	}
	return nil
}
