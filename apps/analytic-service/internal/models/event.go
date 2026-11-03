package models

import "time"

// AnalyticsEvent represents an append-only telemetry frame in PostgreSQL.
type AnalyticsEvent struct {
	ID        int64                  `json:"id"`
	EventType string                 `json:"event_type"`
	UserID    *string                `json:"user_id"`
	Amount    *float64               `json:"amount"`
	Metadata  map[string]interface{} `json:"metadata"`
	CreatedAt time.Time              `json:"created_at"`
}

// BufferedAnalyticsEvent represents an in-flight event payload before bulk copy.
type BufferedAnalyticsEvent struct {
	EventType string                 `json:"event_type"`
	UserID    *string                `json:"user_id"`
	Amount    *float64               `json:"amount"`
	Metadata  map[string]interface{} `json:"metadata"`
	CreatedAt time.Time              `json:"created_at"`
}
