# Multi-Pod WebSocket Desynchronization Hardening (Redis Pub/Sub Backplane)

**Status**: APPROVED & IN PROGRESS  
**Date**: November 2026  
**Scope**: `apps/notification-service`, `docs/EVENT-DRIVEN-ARCHITECTURE.md`

---

## 1. Context & Architectural Problem

The Go-based `notification-service` (`port 8005`) provides in-app real-time notification streaming to storefront and admin users via WebSockets (`GET /ws`).

### The Bottleneck

Previously, the WebSocket connection manager (`internal/websocket/Hub`) maintained client connections exclusively in an in-memory map (`userMap map[string]map[*Client]bool`).
In a scaled horizontal deployment (e.g. multiple Kubernetes pods or Docker replicas behind the API Gateway):

1. User A connects their browser to **Pod 1**.
2. An asynchronous domain event (e.g., `order.created`, `review.approved`) is consumed from Apache Kafka by a worker running on **Pod 2**.
3. **Pod 2** executes `SendToUser(userA, notification)` against its local `userMap`.
4. Because User A is connected to **Pod 1**, **Pod 2**'s local lookup yields 0 active connections.
5. The real-time notification is silently dropped on Pod 2, and User A never receives the live update without manually refreshing the browser.

---

## 2. Shared Architecture & Invariants

```
                                      Kafka: domain events
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                         [Pod 1 (Worker)]        [Pod 2 (Worker)]
                                 │                       │
                       Local userMap check     Local userMap check
                       (Delivers if local)     (Delivers if local)
                                 │                       │
                                 └───────────┬───────────┘
                                             ▼
                             Redis Pub/Sub Channel:
                          'notifications:ws:broadcast'
                             ┌───────────────┴───────────────┐
                             ▼                               ▼
                 [Pod 1 WS Listener]             [Pod 2 WS Listener]
                   (Ignores self)                  (Matches userA!)
                         │                               │
                         ▼                               ▼
                     No-op                        Client WebSocket (User A)
```

### Invariants:

1. **Unified Broadcast Channel**: Uses a single shared Redis Pub/Sub channel (`notifications:ws:broadcast`) to prevent high connection/subscription churn on Redis.
2. **Instant Local Delivery + Peer Broadcast**: When `SendToUser` is triggered on a pod, local connections are delivered immediately (<0.1ms). The pod then dispatches a `BroadcastEnvelope` containing `{ event_id, user_id, origin_instance_id, payload, created_at }` to Redis.
3. **Loop Suppression**: Pods check `origin_instance_id != localInstanceID` before processing inbound Pub/Sub envelopes to prevent duplicate deliveries to local clients.
4. **Fire-and-Forget Failure Isolation**: Redis `PUBLISH` operations run in isolated non-blocking goroutines with a 2-second timeout. If Redis is unavailable or sluggish, local delivery succeeds without stalling the worker pool (fail-open).
5. **Observability & Degraded Probes**: Exposes Prometheus metrics (`ws_redis_pubsub_messages_published_total`, `ws_redis_pubsub_messages_received_total`, `ws_redis_pubsub_errors_total`, `ws_redis_pubsub_connected`) and flags Redis Pub/Sub listener degradation in `/health`.

---

## 3. Implementation Steps

1. **Metrics**: Register Pub/Sub counters and gauges in `internal/observability/metrics.go`.
2. **WebSocket Hub Core**: Update `internal/websocket/hub.go` to accept `*redis.Client`, initialize a UUID `instanceID`, start a background Pub/Sub subscriber with auto-reconnection, and broadcast outbound messages to Redis.
3. **Delivery Logic**: Update `SendToUser` and `BroadcastAll` to push to Redis non-blockingly while preserving instant local delivery.
4. **Health Check**: Integrate Pub/Sub listener status into `internal/handlers/health.go`.
5. **Service Bootstrap**: Update `cmd/notification/main.go` to pass `redisClient` to `websocket.NewHub`.
6. **Automated Unit Tests**: Add test cases in `internal/websocket/hub_test.go` verifying local delivery, envelope marshaling, loop suppression, and nil-Redis fail-open.
7. **Documentation**: Update `apps/notification-service/AGENTS.md` and `README.md`.
