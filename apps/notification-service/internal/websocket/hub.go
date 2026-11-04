package websocket

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

// RedisPubSubChannel is the shared channel for cross-pod WebSocket notification broadcasting.
const RedisPubSubChannel = "notifications:ws:broadcast"

// BroadcastEnvelope models the cross-pod WebSocket notification message envelope.
type BroadcastEnvelope struct {
	EventID          string          `json:"event_id"`
	UserID           string          `json:"user_id"` // specific user ID or "*" for global broadcast
	OriginInstanceID string          `json:"origin_instance_id"`
	Payload          json.RawMessage `json:"payload"`
	CreatedAt        int64           `json:"created_at"`
}

// Hub maintains the set of active clients, manages local WebSocket subscriptions,
// and bridges cross-pod broadcasts over a Redis Pub/Sub backplane.
type Hub struct {
	mu          sync.RWMutex
	clients     map[*Client]bool
	userMap     map[string]map[*Client]bool // userID -> set of clients
	broadcast   chan []byte
	register    chan *Client
	unregister  chan *Client
	logger      *observability.Logger
	metrics     *observability.Metrics
	instanceID  string
	redisClient *redis.Client
	pubsubConn  atomic.Bool
}

func NewHub(logger *observability.Logger, metrics *observability.Metrics, redisClient *redis.Client) *Hub {
	return &Hub{
		clients:     make(map[*Client]bool),
		userMap:     make(map[string]map[*Client]bool),
		broadcast:   make(chan []byte),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		logger:      logger,
		metrics:     metrics,
		instanceID:  "hub_" + uuid.New().String(),
		redisClient: redisClient,
	}
}

// GetInstanceID returns the unique ephemeral instance identifier for this pod's Hub.
func (h *Hub) GetInstanceID() string {
	return h.instanceID
}

// IsRedisPubSubConnected reports whether the Redis Pub/Sub listener is active and connected.
func (h *Hub) IsRedisPubSubConnected() bool {
	if h.redisClient == nil {
		return false
	}
	return h.pubsubConn.Load()
}

// Run starts the Hub main event loop and optional Redis Pub/Sub subscriber.
func (h *Hub) Run(ctx context.Context) {
	if h.redisClient != nil {
		go h.subscribeRedisPubSub(ctx)
	}

	for {
		select {
		case <-ctx.Done():
			h.mu.Lock()
			for client := range h.clients {
				close(client.send)
				if client.conn != nil {
					_ = client.conn.Close()
				}
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
			h.deliverLocalBroadcastRaw(message)
		}
	}
}

// subscribeRedisPubSub connects to the shared Redis Pub/Sub channel and dispatches messages to local clients.
func (h *Hub) subscribeRedisPubSub(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			h.pubsubConn.Store(false)
			if h.metrics != nil {
				h.metrics.WSRedisPubSubConnected.Set(0)
			}
			return
		default:
		}

		pubsub := h.redisClient.Subscribe(ctx, RedisPubSubChannel)
		// Wait for subscription confirmation
		_, err := pubsub.Receive(ctx)
		if err != nil {
			h.pubsubConn.Store(false)
			if h.metrics != nil {
				h.metrics.WSRedisPubSubConnected.Set(0)
				h.metrics.WSRedisPubSubErrorsTotal.Inc()
			}
			h.logger.Warn(ctx, "Failed to subscribe to Redis Pub/Sub channel; retrying in 2s", map[string]interface{}{
				"error":   err.Error(),
				"channel": RedisPubSubChannel,
			})
			_ = pubsub.Close()
			select {
			case <-ctx.Done():
				return
			case <-time.After(2 * time.Second):
				continue
			}
		}

		h.pubsubConn.Store(true)
		if h.metrics != nil {
			h.metrics.WSRedisPubSubConnected.Set(1)
		}
		h.logger.Info(ctx, "Subscribed to Redis Pub/Sub WebSocket backplane", map[string]interface{}{
			"channel":     RedisPubSubChannel,
			"instance_id": h.instanceID,
		})

		ch := pubsub.Channel()
	readLoop:
		for {
			select {
			case <-ctx.Done():
				_ = pubsub.Close()
				h.pubsubConn.Store(false)
				if h.metrics != nil {
					h.metrics.WSRedisPubSubConnected.Set(0)
				}
				return

			case msg, ok := <-ch:
				if !ok {
					h.pubsubConn.Store(false)
					if h.metrics != nil {
						h.metrics.WSRedisPubSubConnected.Set(0)
					}
					h.logger.Warn(ctx, "Redis Pub/Sub channel closed; reconnecting", nil)
					_ = pubsub.Close()
					break readLoop
				}

				if h.metrics != nil {
					h.metrics.WSRedisPubSubReceivedTotal.Inc()
				}

				var envelope BroadcastEnvelope
				if err := json.Unmarshal([]byte(msg.Payload), &envelope); err != nil {
					if h.metrics != nil {
						h.metrics.WSRedisPubSubErrorsTotal.Inc()
					}
					h.logger.Warn(ctx, "Failed to unmarshal Redis Pub/Sub envelope", map[string]interface{}{
						"error":   err.Error(),
						"payload": msg.Payload,
					})
					continue
				}

				// Loop suppression: skip envelopes originated by this pod
				if envelope.OriginInstanceID == h.instanceID {
					continue
				}

				h.handleInboundEnvelope(&envelope)
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(1 * time.Second):
		}
	}
}

// handleInboundEnvelope routes a peer pod's broadcast envelope to local matching WebSocket clients.
func (h *Hub) handleInboundEnvelope(env *BroadcastEnvelope) {
	if env.UserID == "*" {
		h.deliverLocalBroadcastRaw(env.Payload)
		return
	}

	h.deliverLocalUserRaw(env.UserID, env.Payload)
}

// deliverLocalUserRaw pushes raw payload bytes to all locally connected clients for a user.
func (h *Hub) deliverLocalUserRaw(userID string, payload []byte) int {
	h.mu.RLock()
	userClients, exists := h.userMap[userID]
	if !exists || len(userClients) == 0 {
		h.mu.RUnlock()
		return 0
	}

	clients := make([]*Client, 0, len(userClients))
	for client := range userClients {
		clients = append(clients, client)
	}
	h.mu.RUnlock()

	delivered := 0
	for _, client := range clients {
		client.SendRaw(payload)
		delivered++
	}

	return delivered
}

// deliverLocalBroadcastRaw pushes raw payload bytes to all locally connected clients.
func (h *Hub) deliverLocalBroadcastRaw(payload []byte) {
	h.mu.RLock()
	clients := make([]*Client, 0, len(h.clients))
	for client := range h.clients {
		clients = append(clients, client)
	}
	h.mu.RUnlock()

	for _, client := range clients {
		client.SendRaw(payload)
	}
}

// SendToUser pushes a notification to all active client connections for a specific user.
// It delivers to locally connected clients immediately and broadcasts via Redis Pub/Sub for peers.
func (h *Hub) SendToUser(userID string, notification *models.Notification) int {
	payload := map[string]interface{}{
		"type":         "notification",
		"notification": notification,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		h.logger.Error(context.Background(), "Failed to marshal notification WebSocket payload", err)
		return 0
	}

	// 1. Deliver to local clients immediately
	delivered := h.deliverLocalUserRaw(userID, payloadBytes)

	// 2. Broadcast to peer pods via Redis Pub/Sub in a non-blocking goroutine
	if h.redisClient != nil {
		h.publishPeerEnvelope(userID, payloadBytes)
	}

	return delivered
}

// BroadcastAll broadcasts a message to all connected clients locally and across peer pods.
func (h *Hub) BroadcastAll(v interface{}) {
	payloadBytes, err := json.Marshal(v)
	if err != nil {
		return
	}

	h.deliverLocalBroadcastRaw(payloadBytes)

	if h.redisClient != nil {
		h.publishPeerEnvelope("*", payloadBytes)
	}
}

// publishPeerEnvelope dispatches a notification envelope to Redis Pub/Sub in a fire-and-forget goroutine.
func (h *Hub) publishPeerEnvelope(userID string, payloadBytes []byte) {
	envelope := BroadcastEnvelope{
		EventID:          uuid.New().String(),
		UserID:           userID,
		OriginInstanceID: h.instanceID,
		Payload:          payloadBytes,
		CreatedAt:        time.Now().UnixMilli(),
	}

	envelopeBytes, err := json.Marshal(envelope)
	if err != nil {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		if err := h.redisClient.Publish(ctx, RedisPubSubChannel, envelopeBytes).Err(); err != nil {
			if h.metrics != nil {
				h.metrics.WSRedisPubSubErrorsTotal.Inc()
			}
			h.logger.Warn(context.Background(), "Failed to publish WebSocket envelope to Redis Pub/Sub", map[string]interface{}{
				"error":   err.Error(),
				"user_id": userID,
			})
			return
		}

		if h.metrics != nil {
			h.metrics.WSRedisPubSubPublishedTotal.Inc()
		}
	}()
}

// GetActiveClientCount returns the number of currently connected WebSocket clients on this instance.
func (h *Hub) GetActiveClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
