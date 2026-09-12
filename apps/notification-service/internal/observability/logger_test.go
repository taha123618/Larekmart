package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestParseLogLevel(t *testing.T) {
	tests := []struct {
		input string
		want  LogLevel
	}{
		{"debug", LevelDebug},
		{"info", LevelInfo},
		{"warn", LevelWarn},
		{"error", LevelError},
		{"fatal", LevelFatal},
		{"unknown", LevelInfo},
	}

	for _, tt := range tests {
		if got := ParseLogLevel(tt.input); got != tt.want {
			t.Errorf("ParseLogLevel(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestLogger_JSONFormat(t *testing.T) {
	logger := NewLogger("notification-service", "production", "debug", "json")
	var buf bytes.Buffer
	logger.out = &buf
	logger.errOut = &buf

	ctx := context.Background()
	logger.Info(ctx, "Test message", map[string]interface{}{"key": "value"})

	output := buf.String()
	if !strings.Contains(output, `"message":"Test message"`) {
		t.Errorf("expected JSON message, got: %s", output)
	}
	if !strings.Contains(output, `"service":"notification-service"`) {
		t.Errorf("expected service name in JSON, got: %s", output)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(output), &parsed); err != nil {
		t.Fatalf("failed to parse log output as JSON: %v", err)
	}
}

func TestLogger_ErrorLogging(t *testing.T) {
	logger := NewLogger("notification-service", "development", "debug", "json")
	var buf bytes.Buffer
	logger.errOut = &buf

	ctx := context.Background()
	testErr := errors.New("database connection failed")
	logger.Error(ctx, "Query failed", testErr, map[string]interface{}{"retry": 1})

	output := buf.String()
	if !strings.Contains(output, `"error":"database connection failed"`) {
		t.Errorf("expected error field in JSON log, got: %s", output)
	}
	if !strings.Contains(output, `"level":"ERROR"`) {
		t.Errorf("expected level ERROR, got: %s", output)
	}
}
