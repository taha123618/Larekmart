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
	if cfg.BatchSize != 10000 && os.Getenv("ANALYTICS_BATCH_SIZE") == "" {
		t.Errorf("expected default batch size 10000, got %d", cfg.BatchSize)
	}
	if cfg.QueueCapacity != 50000 && os.Getenv("ANALYTICS_QUEUE_CAPACITY") == "" {
		t.Errorf("expected default queue capacity 50000, got %d", cfg.QueueCapacity)
	}
	if cfg.WorkerCount != 3 && os.Getenv("ANALYTICS_WORKER_COUNT") == "" {
		t.Errorf("expected default worker count 3, got %d", cfg.WorkerCount)
	}
	if cfg.FlushInterval != 500*time.Millisecond && os.Getenv("ANALYTICS_FLUSH_INTERVAL_MS") == "" {
		t.Errorf("expected default flush interval 500ms, got %v", cfg.FlushInterval)
	}
}

func TestConfigWorkerCountClamping(t *testing.T) {
	os.Setenv("KAFKA_NUM_PARTITIONS", "3")
	os.Setenv("ANALYTICS_WORKER_COUNT", "6")
	defer func() {
		os.Unsetenv("KAFKA_NUM_PARTITIONS")
		os.Unsetenv("ANALYTICS_WORKER_COUNT")
	}()

	cfg := Load()
	if cfg.WorkerCount != 3 {
		t.Errorf("expected worker count to clamp to 3 partitions, got %d", cfg.WorkerCount)
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
