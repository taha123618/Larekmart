package channels

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

type MockChannel struct {
	channelType models.ChannelType
	sendFunc    func(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error
}

func (m *MockChannel) Name() models.ChannelType {
	return m.channelType
}

func (m *MockChannel) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	if m.sendFunc != nil {
		return m.sendFunc(ctx, delivery, n)
	}
	return nil
}

func TestMockChannelInterface(t *testing.T) {
	var ch Channel = &MockChannel{
		channelType: models.ChannelSMS,
	}

	if ch.Name() != models.ChannelSMS {
		t.Errorf("expected channel name %s, got %s", models.ChannelSMS, ch.Name())
	}

	err := ch.Send(context.Background(), &models.NotificationDelivery{}, &models.Notification{})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}
