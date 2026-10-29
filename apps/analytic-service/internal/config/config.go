package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config encapsulates runtime configuration parameters for analytic-service.
type Config struct {
	Port                       string
	DatabaseURL                string
	RedisURL                   string
	RedisKeyPrefix             string
	ChartCacheTTL              time.Duration
	EventsCacheTTL             time.Duration
	KafkaBrokers               []string
	KafkaGroupID               string
	ClientURL                  string
	AdminURL                   string
	InternalServiceSecret      string
	ClerkSecretKey             string
	AppEnv                     string
	BatchSize                  int
	FlushInterval              time.Duration
	QueueCapacity              int
	WorkerCount                int
}

// Load reads and parses configuration from environment variables with sensible defaults.
func Load() *Config {
	port := getEnv("PORT", "8004")
	dbURL := getEnv("DATABASE_URL", "postgresql://postgres:password123@localhost:5433/analytics_db?sslmode=disable")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379")
	redisPrefix := getEnv("REDIS_KEY_PREFIX", "analytics:v1:")

	chartTTLSec := getEnvAsInt("ANALYTICS_CHART_CACHE_TTL_SECONDS", 60)
	eventsTTLSec := getEnvAsInt("ANALYTICS_EVENTS_CACHE_TTL_SECONDS", 15)

	kafkaBrokersStr := getEnv("KAFKA_BROKERS", "localhost:9094,localhost:9095,localhost:9096")
	kafkaBrokers := splitAndTrim(kafkaBrokersStr, ",")
	kafkaGroupID := getEnv("KAFKA_GROUP_ID", "analytic-service-group")

	batchSize := getEnvAsInt("ANALYTICS_BATCH_SIZE", 1000)
	flushIntervalMs := getEnvAsInt("ANALYTICS_FLUSH_INTERVAL_MS", 500)
	queueCapacity := getEnvAsInt("ANALYTICS_QUEUE_CAPACITY", 10000)
	workerCount := getEnvAsInt("ANALYTICS_WORKER_COUNT", 4)

	return &Config{
		Port:                  port,
		DatabaseURL:           dbURL,
		RedisURL:              redisURL,
		RedisKeyPrefix:        redisPrefix,
		ChartCacheTTL:         time.Duration(chartTTLSec) * time.Second,
		EventsCacheTTL:        time.Duration(eventsTTLSec) * time.Second,
		KafkaBrokers:          kafkaBrokers,
		KafkaGroupID:          kafkaGroupID,
		ClientURL:             getEnv("CLIENT_URL", "http://localhost:3002"),
		AdminURL:              getEnv("ADMIN_URL", "http://localhost:3003"),
		InternalServiceSecret: getEnv("INTERNAL_SERVICE_SECRET", "dev-shared-internal-secret-larekmart"),
		ClerkSecretKey:        getEnv("CLERK_SECRET_KEY", ""),
		AppEnv:                getEnv("APP_ENV", getEnv("NODE_ENV", "development")),
		BatchSize:             batchSize,
		FlushInterval:         time.Duration(flushIntervalMs) * time.Millisecond,
		QueueCapacity:         queueCapacity,
		WorkerCount:           workerCount,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultVal
	}
	return val
}

func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	var out []string
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
