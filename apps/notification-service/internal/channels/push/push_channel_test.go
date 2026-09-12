package push

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestMockPushProvider(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	provider := NewMockProvider(logger)

	err := provider.SendPush(context.Background(), "device_token_abc", "Flash Sale", "50% off all items!", map[string]interface{}{"url": "/deals"})
	if err != nil {
		t.Fatalf("expected nil error from MockPushProvider, got %v", err)
	}
}
