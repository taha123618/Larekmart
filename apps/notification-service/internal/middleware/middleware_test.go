package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

func TestRecoverer_CatchesPanic(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")
	recoverMiddleware := Recoverer(logger)

	panickingHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("simulated critical crash")
	})

	wrapped := recoverMiddleware(panickingHandler)

	req := httptest.NewRequest(http.MethodGet, "/panic-test", nil)
	rec := httptest.NewRecorder()

	wrapped.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500 on panic recovery, got %d", rec.Code)
	}
}

func TestSetupCORS(t *testing.T) {
	corsMiddleware := SetupCORS([]string{"http://localhost:3002"})

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := corsMiddleware(nextHandler)

	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	req.Header.Set("Origin", "http://localhost:3002")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()

	wrapped.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Errorf("expected OK or NoContent for CORS preflight, got %d", rec.Code)
	}
}
