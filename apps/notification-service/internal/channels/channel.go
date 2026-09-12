package channels

import (
	"context"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

// Channel represents a delivery provider interface for sending notifications.
type Channel interface {
	Name() models.ChannelType
	Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error
}
