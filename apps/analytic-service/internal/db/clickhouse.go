package db

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
)

var chLog = observability.NewLogger("analytic-service:clickhouse")

// ClickHouseClient provides a high-performance HTTP client for ClickHouse columnar queries.
type ClickHouseClient struct {
	httpClient *http.Client
	baseURL    string
	username   string
	password   string
	database   string
}

// ClickHouseResponse represents standard ClickHouse JSON query output.
type ClickHouseResponse[T any] struct {
	Data []T `json:"data"`
	Rows int `json:"rows"`
}

// NewClickHouseClient initializes a connection pool to ClickHouse HTTP endpoint.
func NewClickHouseClient(rawURL string) (*ClickHouseClient, error) {
	if rawURL == "" {
		return nil, fmt.Errorf("clickhouse URL is empty")
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid clickhouse URL: %w", err)
	}

	user := "default"
	pass := ""
	if parsed.User != nil {
		user = parsed.User.Username()
		pass, _ = parsed.User.Password()
	}

	dbName := strings.TrimPrefix(parsed.Path, "/")
	if dbName == "" {
		dbName = "analytics_db"
	}

	baseURL := fmt.Sprintf("%s://%s", parsed.Scheme, parsed.Host)

	transport := &http.Transport{
		MaxIdleConns:        50,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second,
	}

	ch := &ClickHouseClient{
		httpClient: client,
		baseURL:    baseURL,
		username:   user,
		password:   pass,
		database:   dbName,
	}

	return ch, nil
}

// Ping verifies ClickHouse connectivity via HTTP ping.
func (ch *ClickHouseClient) Ping(ctx context.Context) error {
	reqURL := fmt.Sprintf("%s/ping", ch.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return err
	}

	resp, err := ch.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("clickhouse ping error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("clickhouse returned non-200 ping status: %d", resp.StatusCode)
	}

	return nil
}

// executeQuery sends a SQL query string with FORMAT JSON to ClickHouse and returns response bytes.
func (ch *ClickHouseClient) executeQuery(ctx context.Context, sqlQuery string) ([]byte, error) {
	params := url.Values{}
	params.Set("database", ch.database)
	if ch.username != "" {
		params.Set("user", ch.username)
	}
	if ch.password != "" {
		params.Set("password", ch.password)
	}

	reqURL := fmt.Sprintf("%s/?%s", ch.baseURL, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewBufferString(sqlQuery))
	if err != nil {
		return nil, fmt.Errorf("failed to create clickhouse request: %w", err)
	}
	req.Header.Set("Content-Type", "application/octet-stream")

	resp, err := ch.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("clickhouse query execution error: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read clickhouse response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("clickhouse error (status %d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}

type chDailyRow struct {
	DateStr      string  `json:"date_str"`
	TotalRevenue float64 `json:"total_revenue"`
	TotalEvents  uint64  `json:"total_events"`
}

// GetDailyAnalytics retrieves aggregated daily metrics from ClickHouse.
func (ch *ClickHouseClient) GetDailyAnalytics(ctx context.Context, days int) ([]models.AnalyticsDailyChart, error) {
	if days <= 0 {
		days = 30
	}
	if days > 365 {
		days = 365
	}

	query := fmt.Sprintf(`
		SELECT
			toString(date) AS date_str,
			sum(total_revenue) AS total_revenue,
			sum(total_events) AS total_events
		FROM %s.analytics_daily_summary
		WHERE date >= today() - %d
		GROUP BY date
		ORDER BY date ASC
		FORMAT JSON;
	`, ch.database, days)

	body, err := ch.executeQuery(ctx, query)
	if err != nil {
		return nil, err
	}

	var parsed ClickHouseResponse[chDailyRow]
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("failed to unmarshal clickhouse daily analytics: %w", err)
	}

	result := make([]models.AnalyticsDailyChart, len(parsed.Data))
	for i, row := range parsed.Data {
		result[i] = models.AnalyticsDailyChart{
			Date:         row.DateStr,
			TotalRevenue: row.TotalRevenue,
			TotalOrders:  int64(row.TotalEvents),
		}
	}

	return result, nil
}

type chEventRow struct {
	ID        string  `json:"id"`
	EventType string  `json:"event_type"`
	UserID    string  `json:"user_id"`
	Amount    float64 `json:"amount"`
	Metadata  string  `json:"metadata"`
	CreatedAt string  `json:"created_at"`
}

// GetRecentEvents retrieves recent streaming events from the ClickHouse MergeTree table.
func (ch *ClickHouseClient) GetRecentEvents(ctx context.Context, limit int) ([]models.AnalyticsEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}

	query := fmt.Sprintf(`
		SELECT
			id,
			event_type,
			user_id,
			amount,
			metadata,
			toString(created_at) AS created_at
		FROM %s.analytics_events
		ORDER BY timestamp DESC
		LIMIT %d
		FORMAT JSON;
	`, ch.database, limit)

	body, err := ch.executeQuery(ctx, query)
	if err != nil {
		return nil, err
	}

	var parsed ClickHouseResponse[chEventRow]
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("failed to unmarshal clickhouse events: %w", err)
	}

	result := make([]models.AnalyticsEvent, len(parsed.Data))
	for i, row := range parsed.Data {
		var meta map[string]interface{}
		if row.Metadata != "" {
			_ = json.Unmarshal([]byte(row.Metadata), &meta)
		}

		t, _ := time.Parse("2006-01-02 15:04:05", row.CreatedAt)
		if t.IsZero() {
			t = time.Now().UTC()
		}
		amt := row.Amount

		var userIdPtr *string
		if row.UserID != "" {
			userIdPtr = &row.UserID
		}

		idVal, _ := strconv.ParseInt(row.ID, 10, 64)
		if idVal == 0 {
			idVal = time.Now().UnixMilli()
		}

		result[i] = models.AnalyticsEvent{
			ID:        idVal,
			EventType: row.EventType,
			UserID:    userIdPtr,
			Amount:    &amt,
			Metadata:  meta,
			CreatedAt: t,
		}
	}

	return result, nil
}
