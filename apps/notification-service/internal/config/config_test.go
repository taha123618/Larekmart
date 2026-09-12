package config

import (
	"os"
	"testing"
	"time"
)

func TestLoadFromEnv_Defaults(t *testing.T) {
	cfg := LoadFromEnv()

	if cfg == nil {
		t.Fatal("expected config to not be nil")
	}

	if cfg.HTTPPort != "8005" && os.Getenv("HTTP_PORT") == "" {
		t.Errorf("expected default HTTPPort=8005, got %s", cfg.HTTPPort)
	}

	if cfg.AppEnv == "" {
		t.Error("expected non-empty AppEnv")
	}

	if cfg.DBMaxOpenConns <= 0 {
		t.Errorf("expected positive DBMaxOpenConns, got %d", cfg.DBMaxOpenConns)
	}
}

func TestLoadFromEnv_CustomValues(t *testing.T) {
	os.Setenv("HTTP_PORT", "9999")
	os.Setenv("APP_ENV", "test")
	os.Setenv("DB_MAX_OPEN_CONNS", "50")
	os.Setenv("EMAIL_SERVICE_ENABLED", "false")
	os.Setenv("IDEMPOTENCY_TTL", "12h")
	os.Setenv("KAFKA_BROKERS", "broker1:9092, broker2:9092")
	defer func() {
		os.Unsetenv("HTTP_PORT")
		os.Unsetenv("APP_ENV")
		os.Unsetenv("DB_MAX_OPEN_CONNS")
		os.Unsetenv("EMAIL_SERVICE_ENABLED")
		os.Unsetenv("IDEMPOTENCY_TTL")
		os.Unsetenv("KAFKA_BROKERS")
	}()

	cfg := LoadFromEnv()

	if cfg.HTTPPort != "9999" {
		t.Errorf("expected HTTPPort 9999, got %s", cfg.HTTPPort)
	}
	if cfg.AppEnv != "test" {
		t.Errorf("expected AppEnv test, got %s", cfg.AppEnv)
	}
	if cfg.DBMaxOpenConns != 50 {
		t.Errorf("expected DBMaxOpenConns 50, got %d", cfg.DBMaxOpenConns)
	}
	if cfg.EmailServiceEnabled != false {
		t.Error("expected EmailServiceEnabled to be false")
	}
	if cfg.IdempotencyTTL != 12*time.Hour {
		t.Errorf("expected IdempotencyTTL 12h, got %v", cfg.IdempotencyTTL)
	}
	if len(cfg.KafkaBrokers) != 2 || cfg.KafkaBrokers[0] != "broker1:9092" || cfg.KafkaBrokers[1] != "broker2:9092" {
		t.Errorf("unexpected KafkaBrokers: %v", cfg.KafkaBrokers)
	}
}
