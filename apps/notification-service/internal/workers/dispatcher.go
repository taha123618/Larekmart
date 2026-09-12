package workers

import (
	"context"
	"fmt"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

// Dispatcher routes notification delivery tasks to the corresponding channel worker pool.
type Dispatcher struct {
	pools       map[models.ChannelType]*ChannelWorkerPool
	maxAttempts int
	logger      *observability.Logger
}

func NewDispatcher(maxAttempts int, logger *observability.Logger) *Dispatcher {
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	return &Dispatcher{
		pools:       make(map[models.ChannelType]*ChannelWorkerPool),
		maxAttempts: maxAttempts,
		logger:      logger,
	}
}

// RegisterPool registers a channel-specific worker pool with the dispatcher.
func (d *Dispatcher) RegisterPool(channelType models.ChannelType, pool *ChannelWorkerPool) {
	d.pools[channelType] = pool
}

// StartAll starts all registered channel worker pools.
func (d *Dispatcher) StartAll() {
	for ch, pool := range d.pools {
		d.logger.Info(context.Background(), fmt.Sprintf("Starting worker pool for channel: %s", ch))
		pool.Start()
	}
}

// Dispatch dispatches a notification's deliveries to their respective channel worker pools.
func (d *Dispatcher) Dispatch(ctx context.Context, n *models.Notification) error {
	for _, delivery := range n.Deliveries {
		pool, exists := d.pools[delivery.Channel]
		if !exists {
			d.logger.Warn(ctx, fmt.Sprintf("No worker pool registered for channel %s; delivery skipped", delivery.Channel), map[string]interface{}{
				"delivery_id": delivery.ID,
			})
			continue
		}

		job := NewDeliveryJob(delivery, n, d.maxAttempts)
		job.Ctx = ctx

		if !pool.Enqueue(job) {
			d.logger.Error(ctx, fmt.Sprintf("Failed to enqueue delivery job %s to %s worker pool", delivery.ID, delivery.Channel), nil)
		}
	}

	return nil
}

// StopAll stops all registered channel worker pools gracefully.
func (d *Dispatcher) StopAll() {
	for ch, pool := range d.pools {
		d.logger.Info(context.Background(), fmt.Sprintf("Stopping worker pool for channel: %s", ch))
		pool.Stop()
	}
}
