package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/middleware"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
)

func TestPreferencesHandler(t *testing.T) {
	prefSvc := services.NewPreferenceService(nil)
	handler := NewPreferencesHandler(prefSvc)

	t.Run("GetPreferences - Unauthorized", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notifications/preferences", nil)
		rec := httptest.NewRecorder()

		handler.GetPreferences(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("GetPreferences - Authorized Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notifications/preferences", nil)
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user_pref_123")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.GetPreferences(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})

	t.Run("UpdatePreferences - Success", func(t *testing.T) {
		body := bytes.NewBufferString(`{"notification_type": "order_update", "email_enabled": true, "sms_enabled": false}`)
		req := httptest.NewRequest(http.MethodPut, "/notifications/preferences", body)
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user_pref_123")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.UpdatePreferences(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})
}
