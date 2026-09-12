package observability

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"go.opentelemetry.io/otel/trace"
)

type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelWarn
	LevelError
	LevelFatal
)

func ParseLogLevel(str string) LogLevel {
	switch str {
	case "debug":
		return LevelDebug
	case "info":
		return LevelInfo
	case "warn":
		return LevelWarn
	case "error":
		return LevelError
	case "fatal":
		return LevelFatal
	default:
		return LevelInfo
	}
}

func (l LogLevel) String() string {
	switch l {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	case LevelFatal:
		return "FATAL"
	default:
		return "INFO"
	}
}

type Logger struct {
	mu          sync.Mutex
	serviceName string
	environment string
	minLevel    LogLevel
	isJSON      bool
	out         io.Writer
	errOut      io.Writer
}

func NewLogger(serviceName, environment, levelStr, format string) *Logger {
	isJSON := format == "json" || environment == "production"
	return &Logger{
		serviceName: serviceName,
		environment: environment,
		minLevel:    ParseLogLevel(levelStr),
		isJSON:      isJSON,
		out:         os.Stdout,
		errOut:      os.Stderr,
	}
}

type logEntry struct {
	Timestamp   string                 `json:"timestamp"`
	Level       string                 `json:"level"`
	Service     string                 `json:"service"`
	Environment string                 `json:"environment"`
	Message     string                 `json:"message"`
	TraceID     string                 `json:"trace_id,omitempty"`
	SpanID      string                 `json:"span_id,omitempty"`
	Fields      map[string]interface{} `json:"metadata,omitempty"`
	Error       string                 `json:"error,omitempty"`
}

func (l *Logger) log(ctx context.Context, level LogLevel, msg string, err error, fields map[string]interface{}) {
	if level < l.minLevel {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	var traceID, spanID string
	if ctx != nil {
		span := trace.SpanFromContext(ctx)
		if span.SpanContext().IsValid() {
			traceID = span.SpanContext().TraceID().String()
			spanID = span.SpanContext().SpanID().String()
		}
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)

	if l.isJSON {
		entry := logEntry{
			Timestamp:   now,
			Level:       level.String(),
			Service:     l.serviceName,
			Environment: l.environment,
			Message:     msg,
			TraceID:     traceID,
			SpanID:      spanID,
			Fields:      fields,
		}
		if err != nil {
			entry.Error = err.Error()
		}

		data, _ := json.Marshal(entry)
		if level >= LevelError {
			fmt.Fprintln(l.errOut, string(data))
		} else {
			fmt.Fprintln(l.out, string(data))
		}
	} else {
		// Pretty console format for development
		errStr := ""
		if err != nil {
			errStr = fmt.Sprintf(" error=%v", err)
		}
		fieldStr := ""
		if len(fields) > 0 {
			fBytes, _ := json.Marshal(fields)
			fieldStr = fmt.Sprintf(" fields=%s", string(fBytes))
		}
		traceStr := ""
		if traceID != "" {
			traceStr = fmt.Sprintf(" [trace:%s]", traceID[:8])
		}

		line := fmt.Sprintf("%s [%s] [%s]%s %s%s%s",
			time.Now().Format("15:04:05.000"),
			level.String(),
			l.serviceName,
			traceStr,
			msg,
			errStr,
			fieldStr,
		)

		if level >= LevelError {
			fmt.Fprintln(l.errOut, line)
		} else {
			fmt.Fprintln(l.out, line)
		}
	}
}

func (l *Logger) Debug(ctx context.Context, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(ctx, LevelDebug, msg, nil, f)
}

func (l *Logger) Info(ctx context.Context, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(ctx, LevelInfo, msg, nil, f)
}

func (l *Logger) Warn(ctx context.Context, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(ctx, LevelWarn, msg, nil, f)
}

func (l *Logger) Error(ctx context.Context, msg string, err error, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(ctx, LevelError, msg, err, f)
}

func (l *Logger) Fatal(ctx context.Context, msg string, err error, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(ctx, LevelFatal, msg, err, f)
	os.Exit(1)
}
