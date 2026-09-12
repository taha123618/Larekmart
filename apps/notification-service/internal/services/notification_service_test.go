package services

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestNotificationService_ProcessAndDispatch(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	prefSvc := NewPreferenceService(nil)
	svc := NewNotificationService(nil, prefSvc, nil, nil, logger, nil)

	t.Run("Validation: missing user_id", func(t *testing.T) {
		_, err := svc.ProcessAndDispatch(context.Background(), CreateNotificationInput{
			UserID: "",
			Title:  "Hello",
			Body:   "World",
		})
		if err == nil {
			t.Fatal("expected error for missing user_id, got nil")
		}
	})

	t.Run("Success: multi-channel creation with email and phone", func(t *testing.T) {
		notif, err := svc.ProcessAndDispatch(context.Background(), CreateNotificationInput{
			UserID:         "user_123",
			Type:           "order_update",
			Title:          "Order Shipped",
			Body:           "Your package is on its way!",
			RecipientEmail: "user@example.com",
			RecipientPhone: "+13306326170",
			Priority:       models.PriorityHigh,
		})
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}

		if notif.ID == "" {
			t.Error("expected non-empty notification ID")
		}
		if notif.Status != models.StatusProcessing {
			t.Errorf("expected status=%s, got %s", models.StatusProcessing, notif.Status)
		}
		if len(notif.Deliveries) < 3 {
			t.Errorf("expected at least 3 delivery channels (inapp, email, sms), got %d", len(notif.Deliveries))
		}
	})

	t.Run("Defaults populated correctly", func(t *testing.T) {
		notif, err := svc.ProcessAndDispatch(context.Background(), CreateNotificationInput{
			UserID: "user_defaults",
			Title:  "Test",
			Body:   "Test body",
		})
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}

		if notif.Type != "general" {
			t.Errorf("expected default type 'general', got %s", notif.Type)
		}
		if notif.Priority != models.PriorityNormal {
			t.Errorf("expected default priority 'normal', got %s", notif.Priority)
		}
	})
}

func TestNotificationService_QueryMethods(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	prefSvc := NewPreferenceService(nil)
	svc := NewNotificationService(nil, prefSvc, nil, nil, logger, nil)

	ctx := context.Background()

	list, err := svc.GetUserNotifications(ctx, "user_1", 10, 0)
	if err != nil || list == nil {
		t.Errorf("expected non-nil empty list, got err: %v", err)
	}

	unread, count, err := svc.GetUnreadNotifications(ctx, "user_1", 10)
	if err != nil || count != 0 || unread == nil {
		t.Errorf("expected 0 unread, got count=%d err=%v", count, err)
	}

	ok, err := svc.MarkAsRead(ctx, "notif_1", "user_1")
	if err != nil || !ok {
		t.Errorf("expected ok=true, got ok=%v err=%v", ok, err)
	}

	markedCount, err := svc.MarkAllAsRead(ctx, "user_1")
	if err != nil || markedCount != 0 {
		t.Errorf("expected markedCount=0, got %d", markedCount)
	}
}
