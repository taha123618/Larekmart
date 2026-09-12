---
name: channel-dispatchers
description: Multi-channel delivery providers, abstractions, and WebSocket streaming in notification-service.
---

# Notification Channels & Dispatchers

Use this skill when adding or updating notification channel implementations (Email, SMS, Push, In-App).

## 1. Channel Interface

All channels implement:

```go
type Channel interface {
    Name() models.ChannelType
    Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error
}
```

## 2. Channel Specifics

- **Email**: Emits `{ value: payload }` envelope to Kafka topic `email.dispatch` for processing by `email-service`.
- **SMS**: Uses `sms.Provider` interface. Pluggable between Twilio, AWS SNS, or `MockProvider`.
- **Push**: Queries active device tokens from `DeviceRepository`, sends via `push.Provider` (FCM/APNS), and deactivates invalid tokens.
- **In-App**: Broadcasts directly to connected clients via `websocket.Hub.SendToUser`.
