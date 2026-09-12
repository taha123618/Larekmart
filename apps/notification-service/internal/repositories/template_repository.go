package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

type TemplateRepository struct {
	db *pgxpool.Pool
}

func NewTemplateRepository(db *pgxpool.Pool) *TemplateRepository {
	return &TemplateRepository{db: db}
}

// FindByNameAndChannel returns the active template for a given event name and delivery channel.
func (r *TemplateRepository) FindByNameAndChannel(ctx context.Context, name string, channel models.ChannelType) (*models.NotificationTemplate, error) {
	query := `
		SELECT id, name, channel, subject, body_template, version, is_active, created_at, updated_at
		FROM notification_templates
		WHERE name = $1 AND channel = $2 AND is_active = TRUE
		ORDER BY version DESC
		LIMIT 1
	`
	row := r.db.QueryRow(ctx, query, name, channel)

	var t models.NotificationTemplate
	err := row.Scan(
		&t.ID, &t.Name, &t.Channel, &t.Subject, &t.BodyTemplate,
		&t.Version, &t.IsActive, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query template: %w", err)
	}

	return &t, nil
}

// ListAll returns all active templates in the system.
func (r *TemplateRepository) ListAll(ctx context.Context) ([]*models.NotificationTemplate, error) {
	query := `
		SELECT id, name, channel, subject, body_template, version, is_active, created_at, updated_at
		FROM notification_templates
		WHERE is_active = TRUE
		ORDER BY name ASC, channel ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list templates: %w", err)
	}
	defer rows.Close()

	var results []*models.NotificationTemplate
	for rows.Next() {
		var t models.NotificationTemplate
		if err := rows.Scan(
			&t.ID, &t.Name, &t.Channel, &t.Subject, &t.BodyTemplate,
			&t.Version, &t.IsActive, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, &t)
	}

	return results, nil
}
