package models

import "time"

// NotificationPreference defines per-channel toggles for a user and notification type.
type NotificationPreference struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	NotificationType string    `json:"notification_type"`
	EmailEnabled     bool      `json:"email_enabled"`
	SMSEnabled       bool      `json:"sms_enabled"`
	PushEnabled      bool      `json:"push_enabled"`
	InAppEnabled     bool      `json:"inapp_enabled"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// UserPreferencesMap is a map of notification_type -> NotificationPreference
type UserPreferencesMap map[string]*NotificationPreference

// DefaultPreference returns sensible default channel preferences for a notification type.
func DefaultPreference(userID, notificationType string) *NotificationPreference {
	return &NotificationPreference{
		UserID:           userID,
		NotificationType: notificationType,
		EmailEnabled:     true,
		SMSEnabled:       false,
		PushEnabled:      true,
		InAppEnabled:     true,
	}
}
