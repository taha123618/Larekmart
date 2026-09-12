package workers

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

type dummyChannel struct {
	sentCount int32
	failUntil int32
}

func (d *dummyChannel) Name() models.ChannelType {
	return models.ChannelInApp
}

func (d *dummyChannel) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	count := atomic.AddInt32(&d.sentCount, 1)
	if count <= atomic.LoadInt32(&d.failUntil) {
		return errors.New("simulated delivery error")
	}
	return nil
}

func TestDeliveryJob(t *testing.T) {
	delivery := &models.NotificationDelivery{
		ID:        "del_1",
		Channel:   models.ChannelInApp,
		Recipient: "user_1",
	}
	notification := &models.Notification{
		ID:    "notif_1",
		Title: "Test",
	}

	job := NewDeliveryJob(delivery, notification, 5)
	if job.ID != "del_1" {
		t.Errorf("expected job ID=del_1, got %s", job.ID)
	}
	if job.MaxAttempts != 5 {
		t.Errorf("expected max attempts=5, got %d", job.MaxAttempts)
	}
	if job.Attempt != 1 {
		t.Errorf("expected initial attempt=1, got %d", job.Attempt)
	}
	if job.CreatedAt.IsZero() {
		t.Error("expected non-zero CreatedAt")
	}
}

func TestChannelWorkerPool_SuccessfulExecution(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	ch := &dummyChannel{}
	pool := NewChannelWorkerPool(models.ChannelInApp, ch, 2, 10, 10*time.Millisecond, nil, logger, nil)
	pool.Start()
	defer pool.Stop()

	delivery := &models.NotificationDelivery{
		ID:        "del_success",
		Channel:   models.ChannelInApp,
		Recipient: "user_test",
	}
	notification := &models.Notification{
		ID:     "notif_1",
		UserID: "user_test",
		Title:  "Order Placed",
	}
	job := NewDeliveryJob(delivery, notification, 3)

	ok := pool.Enqueue(job)
	if !ok {
		t.Fatal("expected enqueue to succeed")
	}

	// Wait briefly for worker to process
	time.Sleep(50 * time.Millisecond)

	if atomic.LoadInt32(&ch.sentCount) != 1 {
		t.Errorf("expected sentCount=1, got %d", atomic.LoadInt32(&ch.sentCount))
	}
}

func TestChannelWorkerPool_RetryAndRecover(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	ch := &dummyChannel{failUntil: 1} // Fails 1st attempt, succeeds 2nd
	pool := NewChannelWorkerPool(models.ChannelInApp, ch, 2, 10, 10*time.Millisecond, nil, logger, nil)
	pool.Start()
	defer pool.Stop()

	delivery := &models.NotificationDelivery{
		ID:        "del_retry",
		Channel:   models.ChannelInApp,
		Recipient: "user_test",
	}
	notification := &models.Notification{
		ID:     "notif_2",
		UserID: "user_test",
		Title:  "Payment Processed",
	}
	job := NewDeliveryJob(delivery, notification, 3)

	ok := pool.Enqueue(job)
	if !ok {
		t.Fatal("expected enqueue to succeed")
	}

	// Wait for first failure, backoff (10-20ms), and second successful attempt
	time.Sleep(150 * time.Millisecond)

	if atomic.LoadInt32(&ch.sentCount) < 2 {
		t.Errorf("expected at least 2 attempts, got %d", atomic.LoadInt32(&ch.sentCount))
	}
}

func TestChannelWorkerPool_ExhaustAttempts(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	ch := &dummyChannel{failUntil: 99} // Always fails
	pool := NewChannelWorkerPool(models.ChannelInApp, ch, 1, 10, 5*time.Millisecond, nil, logger, nil)
	pool.Start()
	defer pool.Stop()

	delivery := &models.NotificationDelivery{
		ID:        "del_exhaust",
		Channel:   models.ChannelInApp,
		Recipient: "user_test",
	}
	notification := &models.Notification{
		ID:     "notif_3",
		UserID: "user_test",
		Title:  "Permanent Failure Notice",
	}
	job := NewDeliveryJob(delivery, notification, 2) // max 2 attempts

	pool.Enqueue(job)

	// Wait for attempt 1, backoff, attempt 2, dead-letter
	time.Sleep(100 * time.Millisecond)

	if atomic.LoadInt32(&ch.sentCount) != 2 {
		t.Errorf("expected exactly 2 attempts, got %d", atomic.LoadInt32(&ch.sentCount))
	}
}

func TestChannelWorkerPool_QueueFull(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	ch := &dummyChannel{}
	// Concurrency 0, queue size 1 (pool not started yet so jobs won't be drained)
	pool := NewChannelWorkerPool(models.ChannelInApp, ch, 1, 1, 10*time.Millisecond, nil, logger, nil)

	delivery := &models.NotificationDelivery{ID: "del_1", Channel: models.ChannelInApp}
	notification := &models.Notification{ID: "notif_1"}

	// First enqueue should succeed (fills queue of size 1)
	if !pool.Enqueue(NewDeliveryJob(delivery, notification, 1)) {
		t.Fatal("expected 1st enqueue to succeed")
	}

	// Second enqueue should fail (queue full)
	if pool.Enqueue(NewDeliveryJob(delivery, notification, 1)) {
		t.Fatal("expected 2nd enqueue to fail due to full queue")
	}
}

func TestDispatcher_RegisterStartDispatchStop(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	dispatcher := NewDispatcher(3, logger)

	ch := &dummyChannel{}
	pool := NewChannelWorkerPool(models.ChannelInApp, ch, 2, 10, 10*time.Millisecond, nil, logger, nil)
	dispatcher.RegisterPool(models.ChannelInApp, pool)

	dispatcher.StartAll()
	defer dispatcher.StopAll()

	notif := &models.Notification{
		ID:     "notif_dispatch_test",
		UserID: "user_dispatch",
		Title:  "Dispatch Test",
		Deliveries: []*models.NotificationDelivery{
			{
				ID:        "del_registered",
				Channel:   models.ChannelInApp,
				Recipient: "user_dispatch",
			},
			{
				ID:        "del_unregistered",
				Channel:   models.ChannelEmail, // Unregistered channel
				Recipient: "email@example.com",
			},
		},
	}

	err := dispatcher.Dispatch(context.Background(), notif)
	if err != nil {
		t.Fatalf("expected nil error on dispatch, got %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	if atomic.LoadInt32(&ch.sentCount) != 1 {
		t.Errorf("expected 1 inapp delivery, got %d", atomic.LoadInt32(&ch.sentCount))
	}
}

func TestChannelWorkerPool_Defaults(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	ch := &dummyChannel{}
	// Pass non-positive values to test defaults
	pool := NewChannelWorkerPool(models.ChannelInApp, ch, -1, 0, 0, nil, logger, nil)
	if pool.concurrency != 5 {
		t.Errorf("expected default concurrency 5, got %d", pool.concurrency)
	}
	if cap(pool.jobQueue) != 500 {
		t.Errorf("expected default queue size 500, got %d", cap(pool.jobQueue))
	}
	if pool.initialBackoff != 500*time.Millisecond {
		t.Errorf("expected default initial backoff 500ms, got %v", pool.initialBackoff)
	}
}
