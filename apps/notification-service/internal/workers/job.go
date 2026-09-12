package workers

import (
	"context"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

// DeliveryJob represents a discrete delivery execution task routed to a worker pool.
type DeliveryJob struct {
	ID           string
	Delivery     *models.NotificationDelivery
	Notification *models.Notification
	Attempt      int
	MaxAttempts  int
	CreatedAt    time.Time
	Ctx          context.Context
}

func NewDeliveryJob(delivery *models.NotificationDelivery, n *models.Notification, maxAttempts int) *DeliveryJob {
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	return &DeliveryJob{
		ID:           delivery.ID,
		Delivery:     delivery,
		Notification: n,
		Attempt:      1,
		MaxAttempts:  maxAttempts,
		CreatedAt:    time.Now().UTC(),
		Ctx:          context.Background(),
	}
}
