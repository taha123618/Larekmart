package push

import (
	"context"
	"fmt"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/repositories"
)

// Provider defines the interface for push gateways (FCM, APNS, WebPush).
type Provider interface {
	SendPush(ctx context.Context, deviceToken, title, body string, data map[string]interface{}) error
}

// MockProvider logs push payloads for development and testing.
type MockProvider struct {
	logger *observability.Logger
}

func NewMockProvider(logger *observability.Logger) *MockProvider {
	return &MockProvider{logger: logger}
}

func (m *MockProvider) SendPush(ctx context.Context, deviceToken, title, body string, data map[string]interface{}) error {
	m.logger.Info(ctx, fmt.Sprintf("[Mock Push] Sent to %s: %s - %s", deviceToken, title, body), map[string]interface{}{
		"token": deviceToken,
	})
	return nil
}

// PushChannel dispatches push notifications across all active user devices.
type PushChannel struct {
	provider   Provider
	deviceRepo *repositories.DeviceRepository
	logger     *observability.Logger
}

func NewPushChannel(provider Provider, deviceRepo *repositories.DeviceRepository, logger *observability.Logger) *PushChannel {
	return &PushChannel{
		provider:   provider,
		deviceRepo: deviceRepo,
		logger:     logger,
	}
}

func (c *PushChannel) Name() models.ChannelType {
	return models.ChannelPush
}

func (c *PushChannel) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	devices, err := c.deviceRepo.FindActiveByUserID(ctx, n.UserID)
	if err != nil {
		c.logger.Error(ctx, "Failed to fetch active devices for push delivery", err, map[string]interface{}{
			"user_id": n.UserID,
		})
		return err
	}

	if len(devices) == 0 {
		c.logger.Debug(ctx, "No active registered devices for user, push skipped", map[string]interface{}{
			"user_id": n.UserID,
		})
		return nil
	}

	for _, d := range devices {
		start := time.Now()
		err := c.provider.SendPush(ctx, d.DeviceToken, n.Title, n.Body, n.Metadata)
		if err != nil {
			c.logger.Warn(ctx, "Push delivery to device failed", map[string]interface{}{
				"token":       d.DeviceToken,
				"platform":    d.Platform,
				"duration_ms": time.Since(start).Milliseconds(),
				"error":       err.Error(),
			})
			// If provider indicates invalid token, deactivate it
			_ = c.deviceRepo.DeactivateToken(ctx, d.DeviceToken)
		} else {
			c.logger.Debug(ctx, "Push notification delivered to device", map[string]interface{}{
				"platform":    d.Platform,
				"duration_ms": time.Since(start).Milliseconds(),
			})
		}
	}

	return nil
}
