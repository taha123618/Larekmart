package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

type NotificationRepository struct {
	db *pgxpool.Pool
}

func NewNotificationRepository(db *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// Create inserts a new Notification and its associated Delivery records in a single transaction.
func (r *NotificationRepository) Create(ctx context.Context, n *models.Notification) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	metaJSON, err := json.Marshal(n.Metadata)
	if err != nil {
		metaJSON = []byte("{}")
	}

	queryNotification := `
		INSERT INTO notifications (id, user_id, type, title, body, metadata, priority, status, read_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err = tx.Exec(ctx, queryNotification,
		n.ID, n.UserID, n.Type, n.Title, n.Body, metaJSON,
		n.Priority, n.Status, n.ReadAt, n.CreatedAt, n.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert notification: %w", err)
	}

	queryDelivery := `
		INSERT INTO notification_deliveries (id, notification_id, channel, recipient, status, attempts, max_attempts, last_error, sent_at, delivered_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	for _, d := range n.Deliveries {
		_, err = tx.Exec(ctx, queryDelivery,
			d.ID, d.NotificationID, d.Channel, d.Recipient, d.Status,
			d.Attempts, d.MaxAttempts, d.LastError, d.SentAt, d.DeliveredAt,
			d.CreatedAt, d.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert delivery %s: %w", d.ID, err)
		}
	}

	return tx.Commit(ctx)
}

// FindByID returns a single Notification by ID including all deliveries.
func (r *NotificationRepository) FindByID(ctx context.Context, id string) (*models.Notification, error) {
	query := `
		SELECT id, user_id, type, title, body, metadata, priority, status, read_at, created_at, updated_at
		FROM notifications WHERE id = $1
	`
	row := r.db.QueryRow(ctx, query, id)

	var n models.Notification
	var metaJSON []byte
	err := row.Scan(
		&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &metaJSON,
		&n.Priority, &n.Status, &n.ReadAt, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find notification: %w", err)
	}
	_ = json.Unmarshal(metaJSON, &n.Metadata)

	// Fetch deliveries
	delQuery := `
		SELECT id, notification_id, channel, recipient, status, attempts, max_attempts, last_error, sent_at, delivered_at, created_at, updated_at
		FROM notification_deliveries WHERE notification_id = $1
	`
	rows, err := r.db.Query(ctx, delQuery, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d models.NotificationDelivery
			if scanErr := rows.Scan(
				&d.ID, &d.NotificationID, &d.Channel, &d.Recipient, &d.Status,
				&d.Attempts, &d.MaxAttempts, &d.LastError, &d.SentAt, &d.DeliveredAt,
				&d.CreatedAt, &d.UpdatedAt,
			); scanErr == nil {
				n.Deliveries = append(n.Deliveries, &d)
			}
		}
	}

	return &n, nil
}

// FindByUserID returns notifications for a user with limit and offset pagination.
func (r *NotificationRepository) FindByUserID(ctx context.Context, userID string, limit, offset int) ([]*models.Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	query := `
		SELECT id, user_id, type, title, body, metadata, priority, status, read_at, created_at, updated_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query notifications by user_id: %w", err)
	}
	defer rows.Close()

	var results []*models.Notification
	for rows.Next() {
		var n models.Notification
		var metaJSON []byte
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &metaJSON,
			&n.Priority, &n.Status, &n.ReadAt, &n.CreatedAt, &n.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(metaJSON, &n.Metadata)
		results = append(results, &n)
	}

	return results, nil
}

// FindUnreadByUserID returns only unread notifications for a user.
func (r *NotificationRepository) FindUnreadByUserID(ctx context.Context, userID string, limit int) ([]*models.Notification, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var totalUnread int
	countQuery := `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`
	if err := r.db.QueryRow(ctx, countQuery, userID).Scan(&totalUnread); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, user_id, type, title, body, metadata, priority, status, read_at, created_at, updated_at
		FROM notifications
		WHERE user_id = $1 AND read_at IS NULL
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query unread notifications: %w", err)
	}
	defer rows.Close()

	var results []*models.Notification
	for rows.Next() {
		var n models.Notification
		var metaJSON []byte
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &metaJSON,
			&n.Priority, &n.Status, &n.ReadAt, &n.CreatedAt, &n.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		_ = json.Unmarshal(metaJSON, &n.Metadata)
		results = append(results, &n)
	}

	return results, totalUnread, nil
}

// MarkAsRead marks a single notification as read for a given user.
func (r *NotificationRepository) MarkAsRead(ctx context.Context, id, userID string) (bool, error) {
	now := time.Now().UTC()
	query := `
		UPDATE notifications
		SET read_at = $1, updated_at = $1
		WHERE id = $2 AND user_id = $3 AND read_at IS NULL
	`
	tag, err := r.db.Exec(ctx, query, now, id, userID)
	if err != nil {
		return false, fmt.Errorf("failed to mark notification as read: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// MarkAllAsRead marks all unread notifications as read for a user.
func (r *NotificationRepository) MarkAllAsRead(ctx context.Context, userID string) (int64, error) {
	now := time.Now().UTC()
	query := `
		UPDATE notifications
		SET read_at = $1, updated_at = $1
		WHERE user_id = $2 AND read_at IS NULL
	`
	tag, err := r.db.Exec(ctx, query, now, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to mark all notifications as read: %w", err)
	}
	return tag.RowsAffected(), nil
}

// UpdateDeliveryStatus updates the status, error, and delivery timestamps for a delivery record.
func (r *NotificationRepository) UpdateDeliveryStatus(ctx context.Context, deliveryID string, status models.DeliveryStatus, attempts int, lastErr *string, deliveredAt *time.Time) error {
	now := time.Now().UTC()
	query := `
		UPDATE notification_deliveries
		SET status = $1, attempts = $2, last_error = $3, delivered_at = $4, updated_at = $5
		WHERE id = $6
	`
	_, err := r.db.Exec(ctx, query, status, attempts, lastErr, deliveredAt, now, deliveryID)
	return err
}

// UpdateNotificationStatus updates the overall notification status.
func (r *NotificationRepository) UpdateNotificationStatus(ctx context.Context, id string, status models.NotificationStatus) error {
	now := time.Now().UTC()
	query := `
		UPDATE notifications
		SET status = $1, updated_at = $2
		WHERE id = $3
	`
	_, err := r.db.Exec(ctx, query, status, now, id)
	return err
}
