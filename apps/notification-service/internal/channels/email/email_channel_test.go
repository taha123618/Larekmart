package email

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestEmailChannel_Disabled(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	channel := NewEmailChannel(nil, "email.dispatch", false, logger)

	delivery := &models.NotificationDelivery{
		ID:        "del_email_1",
		Recipient: "user@example.com",
	}
	notification := &models.Notification{
		ID:    "notif_1",
		Title: "Welcome",
		Body:  "Welcome to Larekmart!",
	}

	err := channel.Send(context.Background(), delivery, notification)
	if err != nil {
		t.Fatalf("expected nil error when channel is disabled, got %v", err)
	}

	if channel.Name() != models.ChannelEmail {
		t.Errorf("expected channel name %s, got %s", models.ChannelEmail, channel.Name())
	}
}
