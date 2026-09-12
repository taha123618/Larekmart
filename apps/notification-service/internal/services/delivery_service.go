package services

import (
	"context"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/workers"
)

type DeliveryService struct {
	dispatcher *workers.Dispatcher
}

func NewDeliveryService(dispatcher *workers.Dispatcher) *DeliveryService {
	return &DeliveryService{dispatcher: dispatcher}
}

// QueueDelivery pushes the notification to the worker pool for parallel multi-channel dispatch.
func (s *DeliveryService) QueueDelivery(ctx context.Context, n *models.Notification) error {
	return s.dispatcher.Dispatch(ctx, n)
}
