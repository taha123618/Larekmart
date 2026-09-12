package inapp

import (
	"context"
	"testing"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/websocket"
)

func TestInAppChannel_Send(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "console")
	hub := websocket.NewHub(logger, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	channel := NewInAppChannel(hub, logger)

	if channel.Name() != models.ChannelInApp {
		t.Errorf("expected channel name %s, got %s", models.ChannelInApp, channel.Name())
	}

	notif := &models.Notification{
		ID:        "notif-123",
		UserID:    "user-456",
		Title:     "Order Confirmed",
		Body:      "Your order has been placed.",
		Priority:  models.PriorityHigh,
		Status:    models.StatusSent,
		CreatedAt: time.Now().UTC(),
	}

	delivery := &models.NotificationDelivery{
		ID:             "del-123",
		NotificationID: notif.ID,
		Channel:        models.ChannelInApp,
		Recipient:      notif.UserID,
		Status:         models.DeliveryPending,
	}

	err := channel.Send(ctx, delivery, notif)
	if err != nil {
		t.Fatalf("expected nil error sending in-app notification to hub, got: %v", err)
	}
}
