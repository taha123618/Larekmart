package consumers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/repositories"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
	"go.opentelemetry.io/otel/trace"
)

type DomainEventHandler struct {
	notificationSvc *services.NotificationService
	templateSvc     *services.TemplateService
	eventRepo       *repositories.EventRepository
	logger          *observability.Logger
	metrics         *observability.Metrics
}

func NewDomainEventHandler(
	notificationSvc *services.NotificationService,
	templateSvc *services.TemplateService,
	eventRepo *repositories.EventRepository,
	logger *observability.Logger,
	metrics *observability.Metrics,
) *DomainEventHandler {
	return &DomainEventHandler{
		notificationSvc: notificationSvc,
		templateSvc:     templateSvc,
		eventRepo:       eventRepo,
		logger:          logger,
		metrics:         metrics,
	}
}

// HandleEvent processes raw JSON message bytes from a Kafka topic.
func (h *DomainEventHandler) HandleEvent(ctx context.Context, topic string, msgKey, rawValue []byte) error {
	tracer := observability.GetTracer("notification-consumer")
	ctx, span := tracer.Start(ctx, fmt.Sprintf("kafka.consume %s", topic), trace.WithSpanKind(trace.SpanKindConsumer))
	defer span.End()

	// 1. Unpack standard monorepo envelope: { "value": payload }
	var envelope models.KafkaEnvelope
	if err := json.Unmarshal(rawValue, &envelope); err != nil {
		// Fallback: try raw payload directly
		var rawMap map[string]interface{}
		if fallbackErr := json.Unmarshal(rawValue, &rawMap); fallbackErr != nil {
			h.logger.Error(ctx, "Failed to decode Kafka event payload", err, map[string]interface{}{"topic": topic})
			return err
		}
		envelope.Value = rawMap
	}

	payload := envelope.Value
	if payload == nil {
		h.logger.Warn(ctx, "Received empty Kafka event payload", map[string]interface{}{"topic": topic})
		return nil
	}

	// 2. Compute deterministic Event ID for idempotency deduplication
	eventID := extractOrComputeEventID(topic, msgKey, rawValue, payload)

	// 3. Fast Redis Deduplication Check
	isDuplicate, err := h.eventRepo.IsDuplicateFast(ctx, eventID)
	if err == nil && isDuplicate {
		h.logger.Info(ctx, fmt.Sprintf("Suppressed duplicate Kafka event '%s' (%s)", topic, eventID), map[string]interface{}{
			"topic":    topic,
			"event_id": eventID,
		})
		if h.metrics != nil {
			h.metrics.DeduplicationHits.Inc()
			h.metrics.EventsConsumedTotal.WithLabelValues(topic, "duplicate").Inc()
		}
		return nil
	}

	// 4. Durable PostgreSQL Idempotency Record
	notifEvent := &models.NotificationEvent{
		ID:            "evt_" + uuid.New().String(),
		EventID:       eventID,
		EventType:     topic,
		SourceService: extractSourceService(topic),
		Payload:       payload,
		Status:        "processing",
		ProcessedAt:   time.Now().UTC(),
	}

	isNew, err := h.eventRepo.RecordEvent(ctx, notifEvent)
	if err != nil {
		h.logger.Warn(ctx, "Failed to record event to database", map[string]interface{}{"error": err.Error()})
	} else if !isNew {
		h.logger.Info(ctx, fmt.Sprintf("Event '%s' already recorded in database", eventID))
		if h.metrics != nil {
			h.metrics.IdempotencyDuplicates.Inc()
			h.metrics.EventsConsumedTotal.WithLabelValues(topic, "duplicate").Inc()
		}
		return nil
	}

	// 5. Route to domain-specific notification resolution
	err = h.dispatchDomainNotification(ctx, topic, payload)
	status := "processed"
	var errMsg *string
	if err != nil {
		status = "failed"
		msg := err.Error()
		errMsg = &msg
		h.logger.Error(ctx, fmt.Sprintf("Failed processing domain event for topic '%s'", topic), err, map[string]interface{}{
			"event_id": eventID,
		})
	}

	_ = h.eventRepo.UpdateEventStatus(ctx, eventID, status, errMsg)

	if h.metrics != nil {
		h.metrics.EventsConsumedTotal.WithLabelValues(topic, status).Inc()
	}

	return err
}

func (h *DomainEventHandler) dispatchDomainNotification(ctx context.Context, topic string, payload map[string]interface{}) error {
	switch topic {
	case "user.created":
		return h.handleUserCreated(ctx, payload)
	case "order.created":
		return h.handleOrderCreated(ctx, payload)
	case "payment.successful":
		return h.handlePaymentSuccessful(ctx, payload)
	case "inventory.low_stock":
		return h.handleInventoryLowStock(ctx, payload)
	case "notification.dispatch":
		return h.handleDirectDispatch(ctx, payload)
	default:
		h.logger.Debug(ctx, fmt.Sprintf("Ignoring unhandled topic '%s'", topic))
		return nil
	}
}

func (h *DomainEventHandler) handleInventoryLowStock(ctx context.Context, payload map[string]interface{}) error {
	productID := payload["productId"]
	availableQty := payload["availableQuantity"]

	title := "Low Stock Alert"
	body := fmt.Sprintf("Product %v is low on stock! Available quantity: %v", productID, availableQty)

	_, err := h.notificationSvc.ProcessAndDispatch(ctx, services.CreateNotificationInput{
		UserID:   "admin",
		Type:     "inventory_alert",
		Title:    title,
		Body:     body,
		Metadata: payload,
		Priority: models.PriorityHigh,
	})
	return err
}

func (h *DomainEventHandler) handleUserCreated(ctx context.Context, payload map[string]interface{}) error {
	username, _ := payload["username"].(string)
	email, _ := payload["email"].(string)
	userID, _ := payload["userId"].(string)
	if userID == "" {
		userID = email
	}

	data := map[string]interface{}{
		"Username": username,
		"Email":    email,
	}

	rendered, _ := h.templateSvc.Render(ctx, "user.created", models.ChannelInApp, data)

	_, err := h.notificationSvc.ProcessAndDispatch(ctx, services.CreateNotificationInput{
		UserID:         userID,
		Type:           "account_welcome",
		Title:          rendered.Subject,
		Body:           rendered.Body,
		RecipientEmail: email,
		Metadata:       payload,
		Priority:       models.PriorityNormal,
	})
	return err
}

func (h *DomainEventHandler) handleOrderCreated(ctx context.Context, payload map[string]interface{}) error {
	email, _ := payload["email"].(string)
	userID, _ := payload["userId"].(string)
	if userID == "" {
		userID = email
	}

	status, _ := payload["status"].(string)
	amountVal := 0.0
	if rawAmount, ok := payload["amount"]; ok {
		switch v := rawAmount.(type) {
		case float64:
			amountVal = v / 100.0 // cents to dollars
		case int:
			amountVal = float64(v) / 100.0
		}
	}

	orderID, _ := payload["orderId"].(string)
	if orderID == "" {
		orderID = "ORD-" + uuid.New().String()[:8]
	}

	data := map[string]interface{}{
		"CustomerName": email,
		"OrderID":      orderID,
		"Amount":       amountVal,
		"Status":       status,
	}

	rendered, _ := h.templateSvc.Render(ctx, "order.created", models.ChannelInApp, data)

	_, err := h.notificationSvc.ProcessAndDispatch(ctx, services.CreateNotificationInput{
		UserID:         userID,
		Type:           "order_update",
		Title:          rendered.Subject,
		Body:           rendered.Body,
		RecipientEmail: email,
		Metadata:       payload,
		Priority:       models.PriorityHigh,
	})
	return err
}

func (h *DomainEventHandler) handlePaymentSuccessful(ctx context.Context, payload map[string]interface{}) error {
	email, _ := payload["email"].(string)
	userID, _ := payload["userId"].(string)
	if userID == "" {
		userID = email
	}

	amountVal := 0.0
	if rawAmount, ok := payload["amount"]; ok {
		switch v := rawAmount.(type) {
		case float64:
			amountVal = v / 100.0
		case int:
			amountVal = float64(v) / 100.0
		}
	}

	data := map[string]interface{}{
		"Amount":        amountVal,
		"TransactionID": uuid.New().String()[:12],
	}

	rendered, _ := h.templateSvc.Render(ctx, "payment.successful", models.ChannelInApp, data)

	_, err := h.notificationSvc.ProcessAndDispatch(ctx, services.CreateNotificationInput{
		UserID:         userID,
		Type:           "payment_receipt",
		Title:          rendered.Subject,
		Body:           rendered.Body,
		RecipientEmail: email,
		Metadata:       payload,
		Priority:       models.PriorityHigh,
	})
	return err
}

func (h *DomainEventHandler) handleDirectDispatch(ctx context.Context, payload map[string]interface{}) error {
	userID, _ := payload["userId"].(string)
	title, _ := payload["title"].(string)
	body, _ := payload["body"].(string)
	notifType, _ := payload["type"].(string)
	email, _ := payload["email"].(string)
	phone, _ := payload["phone"].(string)

	_, err := h.notificationSvc.ProcessAndDispatch(ctx, services.CreateNotificationInput{
		UserID:         userID,
		Type:           notifType,
		Title:          title,
		Body:           body,
		RecipientEmail: email,
		RecipientPhone: phone,
		Metadata:       payload,
		Priority:       models.PriorityNormal,
	})
	return err
}

func extractOrComputeEventID(topic string, key, rawValue []byte, payload map[string]interface{}) string {
	if id, ok := payload["eventId"].(string); ok && id != "" {
		return id
	}
	if id, ok := payload["id"].(string); ok && id != "" {
		return fmt.Sprintf("%s:%s", topic, id)
	}

	hash := sha256.Sum256(append(append([]byte(topic+":"), key...), rawValue...))
	return hex.EncodeToString(hash[:16])
}

func extractSourceService(topic string) string {
	switch topic {
	case "user.created":
		return "auth-service"
	case "order.created":
		return "order-service"
	case "payment.successful":
		return "payment-service"
	case "product.created", "product.deleted":
		return "product-service"
	case "inventory.low_stock", "inventory.created", "inventory.restocked":
		return "inventory-service"
	default:
		return "unknown"
	}
}
