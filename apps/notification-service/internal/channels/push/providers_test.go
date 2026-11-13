package push

import (
	"context"
	"strings"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestMockProvider_SendPush(t *testing.T) {
	logger := observability.NewLogger("notification-service-test", "test", "debug", "pretty")
	provider := NewMockProvider(logger)

	err := provider.SendPush(context.Background(), "sample-device-token", "Order Shipped", "Your package is on its way", map[string]interface{}{
		"order_id": "ord-12345",
	})
	if err != nil {
		t.Fatalf("expected nil error from MockProvider.SendPush, got: %v", err)
	}
}

func TestFCMProvider_UnsetCredentials(t *testing.T) {
	logger := observability.NewLogger("notification-service-test", "test", "debug", "pretty")
	t.Setenv("FCM_CREDENTIALS_JSON", "")
	t.Setenv("FCM_CREDENTIALS_BASE64", "")

	provider := NewFCMProvider("", "", logger)
	err := provider.SendPush(context.Background(), "sample-token", "Title", "Body", nil)
	if err == nil {
		t.Fatal("expected error when FCM credentials are unset, got nil")
	}

	if !strings.Contains(err.Error(), "fcm credentials not provided") {
		t.Errorf("expected error message to mention missing credentials, got: %v", err)
	}
}

func TestAPNSProvider_UnsetCredentials(t *testing.T) {
	logger := observability.NewLogger("notification-service-test", "test", "debug", "pretty")
	t.Setenv("APNS_KEY_PATH", "")
	t.Setenv("APNS_KEY_BASE64", "")
	t.Setenv("APNS_KEY_ID", "")
	t.Setenv("APNS_TEAM_ID", "")
	t.Setenv("APNS_BUNDLE_ID", "")

	provider := NewAPNSProvider(APNSConfig{}, logger)
	err := provider.SendPush(context.Background(), "sample-token", "Title", "Body", nil)
	if err == nil {
		t.Fatal("expected error when APNS credentials are unset, got nil")
	}

	if !strings.Contains(err.Error(), "apns credentials incomplete") && !strings.Contains(err.Error(), "apns key not provided") {
		t.Errorf("expected error message to mention missing apns credentials, got: %v", err)
	}
}
