package websocket

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/middleware"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

// Websocket Work
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow origin check (validated in router CORS or allow all in development)
		return true
	},
}

// ServeWS handles WebSocket connection upgrade requests.
func ServeWS(hub *Hub, logger *observability.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			userID = r.URL.Query().Get("user_id")
		}

		if userID == "" {
			http.Error(w, "Unauthorized: user_id query parameter or Bearer token required", http.StatusUnauthorized)
			return
		}

		deviceID := r.URL.Query().Get("device_id")
		if deviceID == "" {
			deviceID = "ws_" + uuid.New().String()
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Error(r.Context(), "WebSocket upgrade failed", err)
			return
		}

		client := NewClient(hub, conn, userID, deviceID, logger)
		hub.register <- client

		go client.WritePump()
		go client.ReadPump()
	}
}
