package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/analytic-service/migrations"
)

var log = observability.NewLogger("analytic-service:db")

// Database wraps the PostgreSQL connection pool.
type Database struct {
	Pool *pgxpool.Pool
}

// New creates and initializes a pgx connection pool with tuned pool parameters.
func New(ctx context.Context, connString string) (*Database, error) {
	cfg, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	cfg.MaxConns = 25
	cfg.MinConns = 5
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.MaxConnLifetime = 1 * time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create postgres connection pool: %w", err)
	}

	// Verify connectivity
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}

	db := &Database{Pool: pool}
	if err := db.RunMigrations(ctx); err != nil {
		log.Warn("Migration execution warning (continuing if tables exist):", map[string]interface{}{"error": err.Error()})
	}

	return db, nil
}

// Close gracefully closes the connection pool.
func (db *Database) Close() {
	if db != nil && db.Pool != nil {
		db.Pool.Close()
	}
}

// Ping checks pool liveness.
func (db *Database) Ping(ctx context.Context) error {
	if db == nil || db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	return db.Pool.Ping(ctx)
}

// RunMigrations applies the initial schema migration using embedded files.
func (db *Database) RunMigrations(ctx context.Context) error {
	migrationSQL, err := migrations.MigrationFiles.ReadFile("000001_init_schema.up.sql")
	if err != nil {
		return fmt.Errorf("could not read embedded migration file: %w", err)
	}

	_, err = db.Pool.Exec(ctx, string(migrationSQL))
	if err != nil {
		return fmt.Errorf("failed to execute migration: %w", err)
	}

	log.Info("Database migrations applied successfully")
	return nil
}

// CopyFromEvents performs high-velocity bulk insert using PostgreSQL binary COPY protocol.
func (db *Database) CopyFromEvents(ctx context.Context, events []models.BufferedAnalyticsEvent) (int64, error) {
	if len(events) == 0 {
		return 0, nil
	}

	rows := make([][]interface{}, len(events))
	for i, e := range events {
		metaBytes, err := json.Marshal(e.Metadata)
		if err != nil {
			metaBytes = []byte("{}")
		}

		var amountVal interface{}
		if e.Amount != nil {
			amountVal = *e.Amount
		} else {
			amountVal = 0.0
		}

		rows[i] = []interface{}{
			e.EventType,
			e.UserID,
			amountVal,
			metaBytes,
			e.CreatedAt,
		}
	}

	count, err := db.Pool.CopyFrom(
		ctx,
		pgx.Identifier{"analytics_events"},
		[]string{"event_type", "user_id", "amount", "metadata", "created_at"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return 0, fmt.Errorf("pgx.CopyFrom failed for %d events: %w", len(events), err)
	}

	return count, nil
}

// IncrementDailySummary updates daily metric counters atomically.
func (db *Database) IncrementDailySummary(ctx context.Context, revenue float64, orders, signups, products int64) error {
	query := `
		INSERT INTO analytics_daily_summary (date, total_revenue, total_orders, total_signups, total_products_created, updated_at)
		VALUES (CURRENT_DATE, $1, $2, $3, $4, NOW())
		ON CONFLICT (date) DO UPDATE SET
			total_revenue = analytics_daily_summary.total_revenue + EXCLUDED.total_revenue,
			total_orders = analytics_daily_summary.total_orders + EXCLUDED.total_orders,
			total_signups = analytics_daily_summary.total_signups + EXCLUDED.total_signups,
			total_products_created = analytics_daily_summary.total_products_created + EXCLUDED.total_products_created,
			updated_at = NOW();
	`
	_, err := db.Pool.Exec(ctx, query, revenue, orders, signups, products)
	return err
}

// GetDailyAnalytics retrieves historical daily metrics for the requested time horizon.
func (db *Database) GetDailyAnalytics(ctx context.Context, days int) ([]models.AnalyticsDailyChart, error) {
	if days <= 0 {
		days = 30
	}
	if days > 365 {
		days = 365
	}

	query := `
		SELECT
			TO_CHAR(date, 'YYYY-MM-DD') as date_str,
			COALESCE(total_revenue, 0)::float8 as revenue,
			COALESCE(total_orders, 0)::int8 as orders,
			COALESCE(total_signups, 0)::int8 as signups,
			COALESCE(total_products_created, 0)::int8 as products
		FROM analytics_daily_summary
		WHERE date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
		ORDER BY date ASC
	`

	rows, err := db.Pool.Query(ctx, query, days)
	if err != nil {
		return nil, fmt.Errorf("failed to query daily analytics: %w", err)
	}
	defer rows.Close()

	var result []models.AnalyticsDailyChart
	for rows.Next() {
		var item models.AnalyticsDailyChart
		if err := rows.Scan(&item.Date, &item.TotalRevenue, &item.TotalOrders, &item.TotalSignups, &item.TotalProductsCreated); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		result = append(result, item)
	}

	return result, nil
}

// GetRecentEvents retrieves the latest N telemetry events.
func (db *Database) GetRecentEvents(ctx context.Context, limit int) ([]models.AnalyticsEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}

	query := `
		SELECT id, event_type, user_id, amount::float8, metadata, created_at
		FROM analytics_events
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent events: %w", err)
	}
	defer rows.Close()

	var events []models.AnalyticsEvent
	for rows.Next() {
		var e models.AnalyticsEvent
		var metaBytes []byte
		if err := rows.Scan(&e.ID, &e.EventType, &e.UserID, &e.Amount, &metaBytes, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan event row: %w", err)
		}
		if len(metaBytes) > 0 {
			_ = json.Unmarshal(metaBytes, &e.Metadata)
		}
		events = append(events, e)
	}

	return events, nil
}
