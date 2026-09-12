package websocket

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	gorilla "github.com/gorilla/websocket"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestServeWS_Unauthorized(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	hub := NewHub(logger, nil)
	handler := ServeWS(hub, logger)

	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 when no user_id or token provided, got %d", rec.Code)
	}
}

func TestServeWS_UpgradeAndConnect(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	hub := NewHub(logger, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Run(ctx)

	server := httptest.NewServer(ServeWS(hub, logger))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?user_id=user_socket_test"

	dialer := gorilla.DefaultDialer
	conn, resp, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer conn.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("expected status 101, got %d", resp.StatusCode)
	}

	time.Sleep(50 * time.Millisecond)

	if hub.GetActiveClientCount() < 1 {
		t.Errorf("expected at least 1 active client, got %d", hub.GetActiveClientCount())
	}
}
