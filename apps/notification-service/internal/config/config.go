package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration values for notification-service.
type Config struct {
	AppEnv   string
	HTTPPort string

	// Database (PostgreSQL)
	DatabaseURL       string
	DBMaxOpenConns    int
	DBMaxIdleConns    int
	DBConnMaxLifetime time.Duration

	// Redis
	RedisURL       string
	RedisKeyPrefix string
	IdempotencyTTL time.Duration

	// Kafka
	KafkaBrokers        []string
	KafkaGroupID        string
	KafkaTopicPrefix    string
	KafkaConsumerTopics []string

	// Channel Configuration
	EmailServiceEnabled bool
	EmailKafkaDispatch  bool

	SMSProvider       string
	SMSAPIKey         string
	SMSSenderNumber   string
	TwilioAccountSID  string
	TwilioAuthToken   string
	TwilioPhoneNumber string

	PushProvider string
	PushAPIKey   string

	// WebSockets & CORS
	WebSocketAllowedOrigins []string
	WebSocketPingInterval   time.Duration
	WebSocketWriteWait      time.Duration

	// Worker Pools
	WorkerConcurrencyEmail   int
	WorkerConcurrencySMS     int
	WorkerConcurrencyPush    int
	WorkerConcurrencyInApp   int
	WorkerMaxRetries         int
	WorkerInitialBackoffMS   int

	// Observability
	OTELServiceName          string
	OTELExporterOTLPEndpoint string
	OTELEnabled              bool
	LogLevel                 string
	LogFormat                string
}

// LoadFromEnv loads and validates configuration from environment variables.
func LoadFromEnv() *Config {
	return &Config{
		AppEnv:   getEnv("APP_ENV", "development"),
		HTTPPort: getEnv("HTTP_PORT", "8005"),

		DatabaseURL:       getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/notification_db?sslmode=disable"),
		DBMaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 10),
		DBConnMaxLifetime: getEnvDuration("DB_CONN_MAX_LIFETIME", 5*time.Minute),

		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379/0"),
		RedisKeyPrefix: getEnv("REDIS_KEY_PREFIX", "notification:"),
		IdempotencyTTL: getEnvDuration("IDEMPOTENCY_TTL", 24*time.Hour),

		KafkaBrokers:        getEnvSlice("KAFKA_BROKERS", []string{"localhost:9094", "localhost:9095", "localhost:9096"}),
		KafkaGroupID:        getEnv("KAFKA_GROUP_ID", "notification-service-group"),
		KafkaTopicPrefix:    getEnv("KAFKA_TOPIC_PREFIX", ""),
		KafkaConsumerTopics: getEnvSlice("KAFKA_CONSUMER_TOPICS", []string{"user.created", "order.created", "payment.successful", "notification.dispatch"}),

		EmailServiceEnabled: getEnvBool("EMAIL_SERVICE_ENABLED", true),
		EmailKafkaDispatch:  getEnvBool("EMAIL_KAFKA_DISPATCH", true),

		SMSProvider:       getEnv("SMS_PROVIDER", "mock"),
		SMSAPIKey:         getEnv("SMS_API_KEY", "mock-sms-api-key"),
		SMSSenderNumber:   getEnv("SMS_SENDER_NUMBER", getEnv("TWILIO_PHONE_NUMBER", "+1234567890")),
		TwilioAccountSID:  getEnv("TWILIO_ACCOUNT_SID", ""),
		TwilioAuthToken:   getEnv("TWILIO_AUTH_TOKEN", ""),
		TwilioPhoneNumber: getEnv("TWILIO_PHONE_NUMBER", ""),

		PushProvider: getEnv("PUSH_PROVIDER", "mock"),
		PushAPIKey:   getEnv("PUSH_API_KEY", "mock-push-api-key"),

		WebSocketAllowedOrigins: getEnvSlice("WEBSOCKET_ALLOWED_ORIGINS", []string{"http://localhost:3002", "http://localhost:3003"}),
		WebSocketPingInterval:   getEnvDuration("WEBSOCKET_PING_INTERVAL", 30*time.Second),
		WebSocketWriteWait:      getEnvDuration("WEBSOCKET_WRITE_WAIT", 10*time.Second),

		WorkerConcurrencyEmail: getEnvInt("WORKER_CONCURRENCY_EMAIL", 5),
		WorkerConcurrencySMS:   getEnvInt("WORKER_CONCURRENCY_SMS", 5),
		WorkerConcurrencyPush:  getEnvInt("WORKER_CONCURRENCY_PUSH", 5),
		WorkerConcurrencyInApp: getEnvInt("WORKER_CONCURRENCY_INAPP", 10),
		WorkerMaxRetries:       getEnvInt("WORKER_MAX_RETRIES", 3),
		WorkerInitialBackoffMS: getEnvInt("WORKER_INITIAL_BACKOFF_MS", 500),

		OTELServiceName:          getEnv("OTEL_SERVICE_NAME", "notification-service"),
		OTELExporterOTLPEndpoint: getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317"),
		OTELEnabled:              getEnvBool("OTEL_ENABLED", false),
		LogLevel:                 getEnv("LOG_LEVEL", "debug"),
		LogFormat:                getEnv("LOG_FORMAT", "json"),
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			return b
		}
	}
	return defaultVal
}

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return defaultVal
}

func getEnvSlice(key string, defaultVal []string) []string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		parts := strings.Split(val, ",")
		var cleaned []string
		for _, p := range parts {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				cleaned = append(cleaned, trimmed)
			}
		}
		if len(cleaned) > 0 {
			return cleaned
		}
	}
	return defaultVal
}
