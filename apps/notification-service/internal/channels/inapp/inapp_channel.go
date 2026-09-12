package inapp

import (
	"context"
	"fmt"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/websocket"
)

// InAppChannel handles real-time in-app notification streaming via WebSocket Hub.
type InAppChannel struct {
	hub    *websocket.Hub
	logger *observability.Logger
}

func NewInAppChannel(hub *websocket.Hub, logger *observability.Logger) *InAppChannel {
	return &InAppChannel{
		hub:    hub,
		logger: logger,
	}
}

func (c *InAppChannel) Name() models.ChannelType {
	return models.ChannelInApp
}

func (c *InAppChannel) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	clientCount := c.hub.SendToUser(n.UserID, n)

	c.logger.Info(ctx, fmt.Sprintf("In-App notification streamed via WebSocket to %d active client(s)", clientCount), map[string]interface{}{
		"user_id":         n.UserID,
		"notification_id": n.ID,
		"active_clients":  clientCount,
	})

	return nil
}
