package workers

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/channels"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/repositories"
)

// ChannelWorkerPool processes notification delivery jobs for a specific channel using a bounded goroutine pool.
type ChannelWorkerPool struct {
	channelType     models.ChannelType
	channelImpl     channels.Channel
	concurrency     int
	jobQueue        chan *DeliveryJob
	notificationRepo *repositories.NotificationRepository
	logger          *observability.Logger
	metrics         *observability.Metrics
	initialBackoff  time.Duration
	wg              sync.WaitGroup
	ctx             context.Context
	cancel          context.CancelFunc
}

func NewChannelWorkerPool(
	channelType models.ChannelType,
	channelImpl channels.Channel,
	concurrency int,
	queueSize int,
	initialBackoff time.Duration,
	notificationRepo *repositories.NotificationRepository,
	logger *observability.Logger,
	metrics *observability.Metrics,
) *ChannelWorkerPool {
	if concurrency <= 0 {
		concurrency = 5
	}
	if queueSize <= 0 {
		queueSize = 500
	}
	if initialBackoff <= 0 {
		initialBackoff = 500 * time.Millisecond
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &ChannelWorkerPool{
		channelType:      channelType,
		channelImpl:      channelImpl,
		concurrency:      concurrency,
		jobQueue:         make(chan *DeliveryJob, queueSize),
		notificationRepo: notificationRepo,
		logger:           logger,
		metrics:          metrics,
		initialBackoff:   initialBackoff,
		ctx:              ctx,
		cancel:           cancel,
	}
}

// Start spawns the worker goroutines.
func (p *ChannelWorkerPool) Start() {
	for i := 1; i <= p.concurrency; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}
	p.logger.Info(context.Background(), fmt.Sprintf("[%s] Worker pool started with %d workers", p.channelType, p.concurrency))
}

// Enqueue submits a job to the worker queue.
func (p *ChannelWorkerPool) Enqueue(job *DeliveryJob) bool {
	select {
	case p.jobQueue <- job:
		if p.metrics != nil {
			p.metrics.WorkerQueueDepth.WithLabelValues(string(p.channelType)).Set(float64(len(p.jobQueue)))
		}
		return true
	default:
		p.logger.Error(context.Background(), fmt.Sprintf("[%s] Worker queue full, job rejected", p.channelType), nil, map[string]interface{}{
			"delivery_id": job.ID,
		})
		return false
	}
}

func (p *ChannelWorkerPool) worker(id int) {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			return
		case job, ok := <-p.jobQueue:
			if !ok {
				return
			}
			if p.metrics != nil {
				p.metrics.WorkerQueueDepth.WithLabelValues(string(p.channelType)).Set(float64(len(p.jobQueue)))
			}
			p.processJob(job)
		}
	}
}

func (p *ChannelWorkerPool) processJob(job *DeliveryJob) {
	start := time.Now()
	ctx := job.Ctx
	if ctx == nil {
		ctx = p.ctx
	}

	// Update delivery status in DB to processing if repo is provided
	if p.notificationRepo != nil {
		_ = p.notificationRepo.UpdateDeliveryStatus(ctx, job.Delivery.ID, models.DeliveryProcessing, job.Attempt, nil, nil)
	}

	err := p.channelImpl.Send(ctx, job.Delivery, job.Notification)
	duration := time.Since(start)

	if err == nil {
		// Delivery successful
		now := time.Now().UTC()
		if p.notificationRepo != nil {
			_ = p.notificationRepo.UpdateDeliveryStatus(ctx, job.Delivery.ID, models.DeliveryDelivered, job.Attempt, nil, &now)
		}

		if p.metrics != nil {
			p.metrics.DeliveriesTotal.WithLabelValues(string(p.channelType), "delivered").Inc()
			p.metrics.DeliveryDuration.WithLabelValues(string(p.channelType), "delivered").Observe(duration.Seconds())
		}
		return
	}

	// Delivery failed
	errMsg := err.Error()
	p.logger.Warn(ctx, fmt.Sprintf("[%s] Delivery failed for job %s (attempt %d/%d)", p.channelType, job.ID, job.Attempt, job.MaxAttempts), map[string]interface{}{
		"delivery_id": job.ID,
		"attempt":     job.Attempt,
		"error":       errMsg,
	})

	if job.Attempt < job.MaxAttempts {
		// Schedule retry with exponential backoff
		job.Attempt++
		backoff := time.Duration(float64(p.initialBackoff) * math.Pow(2, float64(job.Attempt-1)))

		go func() {
			select {
			case <-p.ctx.Done():
				return
			case <-time.After(backoff):
				p.Enqueue(job)
			}
		}()
	} else {
		// Permanent failure -> Dead Letter status
		p.logger.Error(ctx, fmt.Sprintf("[%s] Job %s exhausted all %d attempts; moved to dead-letter", p.channelType, job.ID, job.MaxAttempts), err, map[string]interface{}{
			"delivery_id": job.ID,
		})
		if p.notificationRepo != nil {
			_ = p.notificationRepo.UpdateDeliveryStatus(ctx, job.Delivery.ID, models.DeliveryDeadLetter, job.Attempt, &errMsg, nil)
		}

		if p.metrics != nil {
			p.metrics.DeliveriesTotal.WithLabelValues(string(p.channelType), "dead_letter").Inc()
			p.metrics.DeliveryDuration.WithLabelValues(string(p.channelType), "dead_letter").Observe(duration.Seconds())
		}
	}
}

// Stop drains active workers and stops the pool.
func (p *ChannelWorkerPool) Stop() {
	p.cancel()
	close(p.jobQueue)
	p.wg.Wait()
	p.logger.Info(context.Background(), fmt.Sprintf("[%s] Worker pool stopped cleanly", p.channelType))
}
