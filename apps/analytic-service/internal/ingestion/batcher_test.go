package ingestion

import (
	"testing"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
)

func TestEventBatcherQueueAndDrain(t *testing.T) {
	// Pass nil db for in-memory queue testing
	batcher := NewBatcher(nil, 50, 50*time.Millisecond, 200)
	batcher.Start()

	if batcher.QueueLength() != 0 {
		t.Errorf("expected empty queue, got %d", batcher.QueueLength())
	}

	for i := 0; i < 25; i++ {
		amount := 10.0
		uid := "user_batch_test"
		enqueued := batcher.Enqueue(models.BufferedAnalyticsEvent{
			EventType: "payment.successful",
			UserID:    &uid,
			Amount:    &amount,
			Metadata:  map[string]interface{}{"idx": i},
			CreatedAt: time.Now(),
		})
		if !enqueued {
			t.Errorf("failed to enqueue event %d", i)
		}
	}

	// Stop must cleanly drain queue
	batcher.Stop()

	if batcher.QueueLength() != 0 {
		t.Errorf("expected queue to be completely drained upon Stop, got %d", batcher.QueueLength())
	}
}
