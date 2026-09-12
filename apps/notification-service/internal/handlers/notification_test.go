package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/middleware"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
)

func TestNotificationHandler(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	prefSvc := services.NewPreferenceService(nil)
	notifSvc := services.NewNotificationService(nil, prefSvc, nil, nil, logger, nil)
	handler := NewNotificationHandler(notifSvc, nil)

	t.Run("GetNotifications - Unauthorized", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notifications", nil)
		rec := httptest.NewRecorder()

		handler.GetNotifications(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("GetNotifications - Authorized Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notifications?limit=10", nil)
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user_test_123")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.GetNotifications(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}

		var resp map[string]interface{}
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if _, exists := resp["notifications"]; !exists {
			t.Error("expected 'notifications' key in response")
		}
	})

	t.Run("GetUnreadNotifications - Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notifications/unread", nil)
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user_test_123")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.GetUnreadNotifications(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})

	t.Run("MarkAllAsRead - Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPatch, "/notifications/read-all", nil)
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user_test_123")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.MarkAllAsRead(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})

	t.Run("RegisterDevice - Success", func(t *testing.T) {
		body := bytes.NewBufferString(`{"device_token": "fcm_token_12345", "platform": "android"}`)
		req := httptest.NewRequest(http.MethodPost, "/notifications/devices", body)
		ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user_test_123")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.RegisterDevice(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
		}
	})
}
