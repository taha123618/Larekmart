package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/taha123618/Larekmart/apps/analytic-service/internal/observability"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// RequestLogger instruments incoming HTTP requests with Prometheus metrics and structured logging.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" || r.URL.Path == "/health/live" || r.URL.Path == "/health/ready" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()
		statusCodeStr := fmt.Sprintf("%d", rw.statusCode)

		observability.HttpRequestDuration.WithLabelValues(r.Method, r.URL.Path, statusCodeStr).Observe(duration)
	})
}
