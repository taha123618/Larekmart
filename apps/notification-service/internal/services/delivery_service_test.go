package services

import (
	"context"
	"testing"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/workers"
)

type mockChannelImpl struct {
	channelType models.ChannelType
}

func (m *mockChannelImpl) Name() models.ChannelType {
	return m.channelType
}

func (m *mockChannelImpl) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	return nil
}

func TestDeliveryService_QueueDelivery(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "console")
	dispatcher := workers.NewDispatcher(3, logger)

	smsChannel := &mockChannelImpl{channelType: models.ChannelSMS}
	pool := workers.NewChannelWorkerPool(
		models.ChannelSMS,
		smsChannel,
		2,
		10,
		10*time.Millisecond,
		nil,
		logger,
		nil,
	)

	dispatcher.RegisterPool(models.ChannelSMS, pool)
	dispatcher.StartAll()
	defer dispatcher.StopAll()

	deliverySvc := NewDeliveryService(dispatcher)

	notif := &models.Notification{
		ID:        "notif-test-1",
		UserID:    "user-1",
		Type:      "order.created",
		Title:     "Order Placed",
		Body:      "Your order is confirmed",
		Priority:  models.PriorityHigh,
		Status:    models.StatusPending,
		CreatedAt: time.Now().UTC(),
		Deliveries: []*models.NotificationDelivery{
			{
				ID:             "del-1",
				NotificationID: "notif-test-1",
				Channel:        models.ChannelSMS,
				Recipient:      "+1234567890",
				Status:         models.DeliveryPending,
			},
		},
	}

	ctx := context.Background()
	err := deliverySvc.QueueDelivery(ctx, notif)
	if err != nil {
		t.Fatalf("expected nil error from QueueDelivery, got: %v", err)
	}
}
