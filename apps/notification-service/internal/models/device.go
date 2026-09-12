package models

import "time"

// UserDevice represents a registered mobile or web device for push notifications.
type UserDevice struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	DeviceToken string    `json:"device_token"`
	Platform    string    `json:"platform"` // ios, android, web
	IsActive    bool      `json:"is_active"`
	LastSeenAt  time.Time `json:"last_seen_at"`
	CreatedAt   time.Time `json:"created_at"`
}
