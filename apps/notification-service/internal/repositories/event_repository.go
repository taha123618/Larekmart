package repositories

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/redis/go-redis/v9"
)

type EventRepository struct {
	db          *pgxpool.Pool
	redisClient *redis.Client
	redisPrefix string
	ttl         time.Duration
}

func NewEventRepository(db *pgxpool.Pool, rdb *redis.Client, prefix string, ttl time.Duration) *EventRepository {
	return &EventRepository{
		db:          db,
		redisClient: rdb,
		redisPrefix: prefix,
		ttl:         ttl,
	}
}

// IsDuplicateFast checks Redis cache for fast event deduplication using atomic SETNX.
// Returns true if event has already been seen, false if it's a new event.
func (r *EventRepository) IsDuplicateFast(ctx context.Context, eventID string) (bool, error) {
	if r.redisClient == nil {
		return false, nil
	}
	key := fmt.Sprintf("%sevent:%s", r.redisPrefix, eventID)
	// SETNX key "1" EX ttl
	isNew, err := r.redisClient.SetNX(ctx, key, "1", r.ttl).Result()
	if err != nil {
		// Non-fatal: if Redis fails, fallback to Postgres
		return false, nil
	}
	return !isNew, nil
}

// RecordEvent persists the domain event into PostgreSQL for durable audit and idempotency check.
func (r *EventRepository) RecordEvent(ctx context.Context, event *models.NotificationEvent) (bool, error) {
	payloadJSON, err := json.Marshal(event.Payload)
	if err != nil {
		payloadJSON = []byte("{}")
	}

	query := `
		INSERT INTO notification_events (id, event_id, event_type, source_service, payload, status, error_message, processed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (event_id) DO NOTHING
	`
	tag, err := r.db.Exec(ctx, query,
		event.ID, event.EventID, event.EventType, event.SourceService,
		payloadJSON, event.Status, event.ErrorMessage, event.ProcessedAt,
	)
	if err != nil {
		return false, fmt.Errorf("failed to record event: %w", err)
	}

	// If 0 rows affected, it was a duplicate
	return tag.RowsAffected() > 0, nil
}

// UpdateEventStatus updates the final status of a processed domain event.
func (r *EventRepository) UpdateEventStatus(ctx context.Context, eventID, status string, errMsg *string) error {
	query := `
		UPDATE notification_events
		SET status = $1, error_message = $2
		WHERE event_id = $3
	`
	_, err := r.db.Exec(ctx, query, status, errMsg, eventID)
	return err
}
