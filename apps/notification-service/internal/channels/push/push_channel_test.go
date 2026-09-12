package push

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestMockPushProvider(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	provider := NewMockProvider(logger)

	err := provider.SendPush(context.Background(), "device_token_abc", "Flash Sale", "50% off all items!", map[string]interface{}{"url": "/deals"})
	if err != nil {
		t.Fatalf("expected nil error from MockPushProvider, got %v", err)
	}
}

func TestPushChannel_Send(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	provider := NewMockProvider(logger)
	ch := NewPushChannel(provider, nil, logger)

	if ch.Name() != models.ChannelPush {
		t.Fatalf("expected channel name push, got %s", ch.Name())
	}

	delivery := &models.NotificationDelivery{
		ID:        "del_push_1",
		Recipient: "device_token_123",
	}
	notification := &models.Notification{
		ID:     "notif_1",
		UserID: "user_123",
		Title:  "Special Promo",
		Body:   "Get ready for our autumn sale!",
	}

	err := ch.Send(context.Background(), delivery, notification)
	if err != nil {
		t.Fatalf("expected nil error when repo is nil, got %v", err)
	}
}
