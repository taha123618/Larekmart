package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/models"
	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
)

var log = observability.NewLogger("analytic-service:redis")

// RedisClient wraps go-redis client with key namespacing and fallback semantics.
type RedisClient struct {
	client *redis.Client
	prefix string
}

// New creates and verifies a Redis connection handle.
func New(redisURL, prefix string) *RedisClient {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Warn("Failed to parse REDIS_URL, running in degraded cache-free mode", map[string]interface{}{"error": err.Error()})
		return &RedisClient{client: nil, prefix: prefix}
	}

	client := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Warn("Redis initial ping failed, running in degraded mode", map[string]interface{}{"error": err.Error()})
	} else {
		log.Info("Connected to Redis successfully", map[string]interface{}{"prefix": prefix})
	}

	return &RedisClient{
		client: client,
		prefix: prefix,
	}
}

// Close disconnects the Redis client.
func (r *RedisClient) Close() {
	if r != nil && r.client != nil {
		_ = r.client.Close()
	}
}

// Ping checks Redis connectivity.
func (r *RedisClient) Ping(ctx context.Context) error {
	if r == nil || r.client == nil {
		return fmt.Errorf("redis client is not initialized")
	}
	return r.client.Ping(ctx).Err()
}

func (r *RedisClient) formatKey(key string) string {
	return fmt.Sprintf("%s%s", r.prefix, key)
}

// GetDailyChart retrieves cached daily chart items.
func (r *RedisClient) GetDailyChart(ctx context.Context, days int) ([]models.AnalyticsDailyChart, bool) {
	if r == nil || r.client == nil {
		return nil, false
	}

	key := r.formatKey(fmt.Sprintf("daily-chart:%d", days))
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			observability.CacheMissesTotal.WithLabelValues("daily-chart").Inc()
		} else {
			observability.CacheErrorsTotal.WithLabelValues("daily-chart").Inc()
		}
		return nil, false
	}

	var chart []models.AnalyticsDailyChart
	if err := json.Unmarshal(data, &chart); err != nil {
		observability.CacheErrorsTotal.WithLabelValues("daily-chart").Inc()
		return nil, false
	}

	observability.CacheHitsTotal.WithLabelValues("daily-chart").Inc()
	return chart, true
}

// SetDailyChart stores daily chart items with TTL.
func (r *RedisClient) SetDailyChart(ctx context.Context, days int, data []models.AnalyticsDailyChart, ttl time.Duration) {
	if r == nil || r.client == nil {
		return
	}

	key := r.formatKey(fmt.Sprintf("daily-chart:%d", days))
	bytes, err := json.Marshal(data)
	if err != nil {
		return
	}

	_ = r.client.Set(ctx, key, bytes, ttl).Err()
}

// GetRecentEvents retrieves cached recent events.
func (r *RedisClient) GetRecentEvents(ctx context.Context, limit int) ([]models.AnalyticsEvent, bool) {
	if r == nil || r.client == nil {
		return nil, false
	}

	key := r.formatKey(fmt.Sprintf("recent-events:%d", limit))
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			observability.CacheMissesTotal.WithLabelValues("recent-events").Inc()
		} else {
			observability.CacheErrorsTotal.WithLabelValues("recent-events").Inc()
		}
		return nil, false
	}

	var events []models.AnalyticsEvent
	if err := json.Unmarshal(data, &events); err != nil {
		observability.CacheErrorsTotal.WithLabelValues("recent-events").Inc()
		return nil, false
	}

	observability.CacheHitsTotal.WithLabelValues("recent-events").Inc()
	return events, true
}

// SetRecentEvents stores recent events with TTL.
func (r *RedisClient) SetRecentEvents(ctx context.Context, limit int, events []models.AnalyticsEvent, ttl time.Duration) {
	if r == nil || r.client == nil {
		return
	}

	key := r.formatKey(fmt.Sprintf("recent-events:%d", limit))
	bytes, err := json.Marshal(events)
	if err != nil {
		return
	}

	_ = r.client.Set(ctx, key, bytes, ttl).Err()
}
