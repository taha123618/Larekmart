package services

import (
	"testing"
	"time"
)

func TestFrequencyDigestAndRetryVisibility(t *testing.T) {
	mgr := NewFrequencyDigestManager()
	now := time.Now().UTC()

	mgr.SetPolicy(FrequencyPolicy{
		UserID:     "usr_1",
		MaxPerHour: 2,
		MaxPerDay:  5,
		DigestMode: DigestImmediate,
	})

	if d := mgr.EvaluateDispatch("usr_1", "EMAIL", "n1", now); d != "DISPATCH_NOW" {
		t.Fatalf("expected DISPATCH_NOW, got %s", d)
	}
	if d := mgr.EvaluateDispatch("usr_1", "EMAIL", "n2", now.Add(time.Minute)); d != "DISPATCH_NOW" {
		t.Fatalf("expected DISPATCH_NOW, got %s", d)
	}
	if d := mgr.EvaluateDispatch("usr_1", "EMAIL", "n3", now.Add(2*time.Minute)); d != "THROTTLED" {
		t.Fatalf("expected THROTTLED after hourly cap, got %s", d)
	}

	mgr.SetPolicy(FrequencyPolicy{
		UserID:     "usr_2",
		DigestMode: DigestDaily,
	})
	if d := mgr.EvaluateDispatch("usr_2", "EMAIL", "n4", now); d != "QUEUED_FOR_DIGEST" {
		t.Fatalf("expected QUEUED_FOR_DIGEST, got %s", d)
	}
	if items := mgr.FlushDigest("usr_2"); len(items) != 1 || items[0] != "n4" {
		t.Fatalf("expected flushed digest [n4], got %v", items)
	}

	mgr.RecordRetry(RetryVisibilityRecord{
		NotificationID: "n5",
		Channel:        "SMS",
		AttemptCount:   2,
		MaxAttempts:    3,
		NextRetryAt:    now.Add(5 * time.Minute).Format(time.RFC3339),
		LastError:      "upstream timeout",
		Status:         "RETRY_SCHEDULED",
	})
	if rec, ok := mgr.GetRetryStatus("n5"); !ok || rec.AttemptCount != 2 {
		t.Fatalf("expected retry record with attemptCount 2, got %+v", rec)
	}
}
