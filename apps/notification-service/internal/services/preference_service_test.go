package services

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

func TestDefaultPreference(t *testing.T) {
	pref := models.DefaultPreference("user_123", "order_update")

	if pref.UserID != "user_123" {
		t.Errorf("expected user_id=user_123, got %s", pref.UserID)
	}
	if !pref.EmailEnabled {
		t.Error("expected email_enabled=true by default")
	}
	if pref.SMSEnabled {
		t.Error("expected sms_enabled=false by default")
	}
	if !pref.PushEnabled {
		t.Error("expected push_enabled=true by default")
	}
	if !pref.InAppEnabled {
		t.Error("expected inapp_enabled=true by default")
	}
}

func TestPreferenceService_Validation(t *testing.T) {
	svc := NewPreferenceService(nil)
	ctx := context.Background()

	_, err := svc.GetUserPreferences(ctx, "")
	if err == nil {
		t.Error("expected error on empty user_id, got nil")
	}

	err = svc.UpdatePreference(ctx, &models.NotificationPreference{})
	if err == nil {
		t.Error("expected error on empty preference fields, got nil")
	}
}
