package models

import "time"

// NotificationEvent records consumed domain events for idempotency, deduplication, and auditing.
type NotificationEvent struct {
	ID            string                 `json:"id"`
	EventID       string                 `json:"event_id"`
	EventType     string                 `json:"event_type"`
	SourceService string                 `json:"source_service"`
	Payload       map[string]interface{} `json:"payload"`
	Status        string                 `json:"status"` // received, processed, duplicate, failed
	ErrorMessage  *string                `json:"error_message,omitempty"`
	ProcessedAt   time.Time              `json:"processed_at"`
}

// KafkaEnvelope represents the standard { "value": payload } wrapper used monorepo-wide.
type KafkaEnvelope struct {
	Value map[string]interface{} `json:"value"`
}
