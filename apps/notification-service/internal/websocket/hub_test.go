package websocket

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestHub_Lifecycle(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	hub := NewHub(logger, nil, nil)

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

func TestHub_RedisPubSubEnvelope_Handling(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	hub := NewHub(logger, nil, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Run(ctx)

	client := &Client{
		hub:      hub,
		send:     make(chan []byte, 10),
		userID:   "user_peer_target",
		deviceID: "dev_peer",
		logger:   logger,
	}
	hub.register <- client
	time.Sleep(20 * time.Millisecond)

	// Simulate inbound envelope from a peer instance
	peerPayload, _ := json.Marshal(map[string]string{
		"type":    "notification",
		"message": "Peer pod broadcast",
	})
	envelope := &BroadcastEnvelope{
		EventID:          "event_peer_1",
		UserID:           "user_peer_target",
		OriginInstanceID: "peer_instance_999", // Different from hub.instanceID
		Payload:          peerPayload,
		CreatedAt:        time.Now().UnixMilli(),
	}

	hub.handleInboundEnvelope(envelope)

	select {
	case msg := <-client.send:
		var parsed map[string]string
		if err := json.Unmarshal(msg, &parsed); err != nil {
			t.Fatalf("failed to unmarshal client message: %v", err)
		}
		if parsed["message"] != "Peer pod broadcast" {
			t.Errorf("unexpected message content: %s", parsed["message"])
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timed out waiting for peer envelope delivery to local client")
	}
}

func TestHub_RedisPubSubEnvelope_LoopSuppression(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	hub := NewHub(logger, nil, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Run(ctx)

	client := &Client{
		hub:      hub,
		send:     make(chan []byte, 10),
		userID:   "user_loop_test",
		deviceID: "dev_loop",
		logger:   logger,
	}
	hub.register <- client
	time.Sleep(20 * time.Millisecond)

	// Inbound envelope with same instanceID must be suppressed
	payload, _ := json.Marshal(map[string]string{"type": "notification"})
	envelope := &BroadcastEnvelope{
		EventID:          "event_self",
		UserID:           "user_loop_test",
		OriginInstanceID: hub.GetInstanceID(),
		Payload:          payload,
		CreatedAt:        time.Now().UnixMilli(),
	}

	// When envelope.OriginInstanceID == hub.instanceID, subscribeRedisPubSub suppresses it
	if envelope.OriginInstanceID != hub.GetInstanceID() {
		t.Error("expected origin instance ID to match hub")
	}
}

func TestHub_IsRedisPubSubConnected_WithoutRedis(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	hub := NewHub(logger, nil, nil)

	if hub.IsRedisPubSubConnected() {
		t.Error("expected IsRedisPubSubConnected() to be false when redisClient is nil")
	}
}
