package models

import "time"

// NotificationTemplate represents a parameterized template for rendering notification content.
type NotificationTemplate struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Channel      ChannelType `json:"channel"`
	Subject      *string     `json:"subject,omitempty"`
	BodyTemplate string      `json:"body_template"`
	Version      int         `json:"version"`
	IsActive     bool        `json:"is_active"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}
