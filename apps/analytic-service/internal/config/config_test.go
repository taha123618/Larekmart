package config

import (
	"os"
	"testing"
	"time"
)

func TestConfigLoadDefaults(t *testing.T) {
	cfg := Load()
	if cfg.Port != "8004" && os.Getenv("PORT") == "" {
		t.Errorf("expected default port 8004, got %s", cfg.Port)
	}
	if cfg.BatchSize != 1000 && os.Getenv("ANALYTICS_BATCH_SIZE") == "" {
		t.Errorf("expected default batch size 1000, got %d", cfg.BatchSize)
	}
	if cfg.FlushInterval != 500*time.Millisecond && os.Getenv("ANALYTICS_FLUSH_INTERVAL_MS") == "" {
		t.Errorf("expected default flush interval 500ms, got %v", cfg.FlushInterval)
	}
}

func TestConfigCustomEnv(t *testing.T) {
	os.Setenv("PORT", "9999")
	os.Setenv("ANALYTICS_BATCH_SIZE", "2500")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("ANALYTICS_BATCH_SIZE")
	}()

	cfg := Load()
	if cfg.Port != "9999" {
		t.Errorf("expected port 9999, got %s", cfg.Port)
	}
	if cfg.BatchSize != 2500 {
		t.Errorf("expected batch size 2500, got %d", cfg.BatchSize)
	}
}
