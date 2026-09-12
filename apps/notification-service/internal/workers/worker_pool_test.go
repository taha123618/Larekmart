package workers

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

type dummyChannel struct {
	sentCount int
}

func (d *dummyChannel) Name() models.ChannelType {
	return models.ChannelInApp
}

func (d *dummyChannel) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	d.sentCount++
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

func TestDispatcher_RegisterAndStop(t *testing.T) {
	dispatcher := NewDispatcher(3, nil)

	if len(dispatcher.pools) != 0 {
		t.Errorf("expected 0 initial pools, got %d", len(dispatcher.pools))
	}

	// Should not panic on empty dispatcher StopAll
	dispatcher.StopAll()
}

