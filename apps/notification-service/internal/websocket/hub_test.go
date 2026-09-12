package websocket

import (
	"context"
	"testing"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestHub_Lifecycle(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	hub := NewHub(logger, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	// Verify initial client count is 0
	if count := hub.GetActiveClientCount(); count != 0 {
		t.Errorf("expected initial client count 0, got %d", count)
	}

	// Create dummy client
	client := &Client{
		hub:      hub,
		send:     make(chan []byte, 10),
		userID:   "user_test_42",
		deviceID: "dev_1",
		logger:   logger,
	}

	// Register client
	hub.register <- client
	time.Sleep(20 * time.Millisecond)

	if count := hub.GetActiveClientCount(); count != 1 {
		t.Errorf("expected 1 registered client, got %d", count)
	}

	// Send notification to user
	n := &models.Notification{
		ID:    "notif_100",
		Title: "Order Shipped",
		Body:  "Your order is on the way.",
	}
	delivered := hub.SendToUser("user_test_42", n)
	if delivered != 1 {
		t.Errorf("expected 1 delivered message, got %d", delivered)
	}

	select {
	case msg := <-client.send:
		if len(msg) == 0 {
			t.Error("received empty message payload on client send channel")
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("timeout waiting for message on client send channel")
	}

	// Send to non-existent user returns 0
	deliveredOther := hub.SendToUser("user_non_existent", n)
	if deliveredOther != 0 {
		t.Errorf("expected 0 deliveries for unknown user, got %d", deliveredOther)
	}

	// Unregister client
	hub.unregister <- client
	time.Sleep(20 * time.Millisecond)

	if count := hub.GetActiveClientCount(); count != 0 {
		t.Errorf("expected 0 clients after unregister, got %d", count)
	}
}
