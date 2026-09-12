package websocket

import (
	"context"
	"sync"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

// Hub maintains the set of active clients and broadcasts messages to them.
type Hub struct {
	mu         sync.RWMutex
	clients    map[*Client]bool
	userMap    map[string]map[*Client]bool // userID -> set of clients
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	logger     *observability.Logger
	metrics    *observability.Metrics
}

func NewHub(logger *observability.Logger, metrics *observability.Metrics) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		userMap:    make(map[string]map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		logger:     logger,
		metrics:    metrics,
	}
}

// Run starts the Hub main event loop.
func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			h.mu.Lock()
			for client := range h.clients {
				close(client.send)
				_ = client.conn.Close()
			}
			h.clients = make(map[*Client]bool)
			h.userMap = make(map[string]map[*Client]bool)
			h.mu.Unlock()
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if h.userMap[client.userID] == nil {
				h.userMap[client.userID] = make(map[*Client]bool)
			}
			h.userMap[client.userID][client] = true
			if h.metrics != nil {
				h.metrics.ActiveWSConnections.Set(float64(len(h.clients)))
			}
			h.mu.Unlock()
			h.logger.Debug(ctx, "WebSocket client registered", map[string]interface{}{"user_id": client.userID})

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)

				if userClients, exists := h.userMap[client.userID]; exists {
					delete(userClients, client)
					if len(userClients) == 0 {
						delete(h.userMap, client.userID)
					}
				}
				if h.metrics != nil {
					h.metrics.ActiveWSConnections.Set(float64(len(h.clients)))
				}
			}
			h.mu.Unlock()
			h.logger.Debug(ctx, "WebSocket client unregistered", map[string]interface{}{"user_id": client.userID})

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// SendToUser pushes a notification to all active client connections for a specific user.
func (h *Hub) SendToUser(userID string, notification *models.Notification) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userClients, exists := h.userMap[userID]
	if !exists || len(userClients) == 0 {
		return 0
	}

	payload := map[string]interface{}{
		"type":         "notification",
		"notification": notification,
	}

	delivered := 0
	for client := range userClients {
		client.SendJSON(payload)
		delivered++
	}

	return delivered
}

// BroadcastAll broadcasts a notification to all connected clients.
func (h *Hub) BroadcastAll(v interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		client.SendJSON(v)
	}
}

// GetActiveClientCount returns the number of currently connected WebSocket clients.
func (h *Hub) GetActiveClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
