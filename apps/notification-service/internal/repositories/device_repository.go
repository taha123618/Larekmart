package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

type DeviceRepository struct {
	db *pgxpool.Pool
}

func NewDeviceRepository(db *pgxpool.Pool) *DeviceRepository {
	return &DeviceRepository{db: db}
}

// RegisterDevice registers or updates a user device token.
func (r *DeviceRepository) RegisterDevice(ctx context.Context, userID, token, platform string) error {
	id := "dev_" + uuid.New().String()
	now := time.Now().UTC()

	query := `
		INSERT INTO user_devices (id, user_id, device_token, platform, is_active, last_seen_at, created_at)
		VALUES ($1, $2, $3, $4, TRUE, $5, $5)
		ON CONFLICT (user_id, device_token) DO UPDATE SET
			is_active = TRUE,
			platform = EXCLUDED.platform,
			last_seen_at = EXCLUDED.last_seen_at
	`
	_, err := r.db.Exec(ctx, query, id, userID, token, platform, now)
	if err != nil {
		return fmt.Errorf("failed to register device: %w", err)
	}
	return nil
}

// FindActiveByUserID returns all active registered devices for a user.
func (r *DeviceRepository) FindActiveByUserID(ctx context.Context, userID string) ([]*models.UserDevice, error) {
	query := `
		SELECT id, user_id, device_token, platform, is_active, last_seen_at, created_at
		FROM user_devices
		WHERE user_id = $1 AND is_active = TRUE
		ORDER BY last_seen_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query devices: %w", err)
	}
	defer rows.Close()

	var devices []*models.UserDevice
	for rows.Next() {
		var d models.UserDevice
		if err := rows.Scan(
			&d.ID, &d.UserID, &d.DeviceToken, &d.Platform,
			&d.IsActive, &d.LastSeenAt, &d.CreatedAt,
		); err != nil {
			return nil, err
		}
		devices = append(devices, &d)
	}
	return devices, nil
}

// DeactivateToken marks a dead or invalid token as inactive.
func (r *DeviceRepository) DeactivateToken(ctx context.Context, token string) error {
	query := `UPDATE user_devices SET is_active = FALSE WHERE device_token = $1`
	_, err := r.db.Exec(ctx, query, token)
	return err
}
