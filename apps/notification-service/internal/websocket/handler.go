package websocket

import (
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/middleware"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func isOriginAllowed(origin string) bool {
	if origin == "" {
		return true // non-browser requests
	}
	allowed := []string{
		"http://localhost:3000",
		"http://localhost:3001",
		"http://localhost:3002",
		"http://localhost:3003",
		"https://larekmart.com",
		"https://admin.larekmart.com",
		"https://staging.larekmart.com",
	}
	if envOrigins := os.Getenv("WEBSOCKET_ALLOWED_ORIGINS"); envOrigins != "" {
		for _, o := range strings.Split(envOrigins, ",") {
			allowed = append(allowed, strings.TrimSpace(o))
		}
	}
	for _, a := range allowed {
		if strings.EqualFold(origin, a) {
			return true
		}
	}
	return os.Getenv("APP_ENV") != "production"
}

// Websocket Work
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return isOriginAllowed(r.Header.Get("Origin"))
	},
}

// ServeWS handles WebSocket connection upgrade requests.
func ServeWS(hub *Hub, logger *observability.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			userID = middleware.ExtractUserID(r)
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
