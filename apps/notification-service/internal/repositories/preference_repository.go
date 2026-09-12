package repositories

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

type PreferenceRepository struct {
	db *pgxpool.Pool
}

func NewPreferenceRepository(db *pgxpool.Pool) *PreferenceRepository {
	return &PreferenceRepository{db: db}
}

// FindByUserID returns all preferences configured for a user.
func (r *PreferenceRepository) FindByUserID(ctx context.Context, userID string) (models.UserPreferencesMap, error) {
	query := `
		SELECT id, user_id, notification_type, email_enabled, sms_enabled, push_enabled, inapp_enabled, created_at, updated_at
		FROM notification_preferences
		WHERE user_id = $1
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query preferences: %w", err)
	}
	defer rows.Close()

	result := make(models.UserPreferencesMap)
	for rows.Next() {
		var p models.NotificationPreference
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.NotificationType, &p.EmailEnabled,
			&p.SMSEnabled, &p.PushEnabled, &p.InAppEnabled, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result[p.NotificationType] = &p
	}

	return result, nil
}

// Upsert creates or updates a user preference for a given notification type.
func (r *PreferenceRepository) Upsert(ctx context.Context, p *models.NotificationPreference) error {
	if p.ID == "" {
		p.ID = "pref_" + uuid.New().String()
	}
	now := time.Now().UTC()
	p.UpdatedAt = now
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}

	query := `
		INSERT INTO notification_preferences (id, user_id, notification_type, email_enabled, sms_enabled, push_enabled, inapp_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, notification_type) DO UPDATE SET
			email_enabled = EXCLUDED.email_enabled,
			sms_enabled = EXCLUDED.sms_enabled,
			push_enabled = EXCLUDED.push_enabled,
			inapp_enabled = EXCLUDED.inapp_enabled,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.db.Exec(ctx, query,
		p.ID, p.UserID, p.NotificationType, p.EmailEnabled,
		p.SMSEnabled, p.PushEnabled, p.InAppEnabled, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert preference: %w", err)
	}
	return nil
}

// GetUserPreferenceForType returns the preference for a specific type, returning default if not found.
func (r *PreferenceRepository) GetUserPreferenceForType(ctx context.Context, userID, notifType string) (*models.NotificationPreference, error) {
	query := `
		SELECT id, user_id, notification_type, email_enabled, sms_enabled, push_enabled, inapp_enabled, created_at, updated_at
		FROM notification_preferences
		WHERE user_id = $1 AND notification_type = $2
	`
	row := r.db.QueryRow(ctx, query, userID, notifType)

	var p models.NotificationPreference
	err := row.Scan(
		&p.ID, &p.UserID, &p.NotificationType, &p.EmailEnabled,
		&p.SMSEnabled, &p.PushEnabled, &p.InAppEnabled, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.DefaultPreference(userID, notifType), nil
		}
		return nil, fmt.Errorf("failed to get preference: %w", err)
	}

	return &p, nil
}
