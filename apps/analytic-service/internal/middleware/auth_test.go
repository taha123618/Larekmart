package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestAuthMiddleware(t *testing.T) {
	os.Setenv("INTERNAL_SERVICE_SECRET", "test-secret-123")
	os.Setenv("APP_ENV", "production")
	os.Setenv("NODE_ENV", "production")
	defer func() {
		os.Unsetenv("INTERNAL_SERVICE_SECRET")
		os.Unsetenv("APP_ENV")
		os.Unsetenv("NODE_ENV")
	}()

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	adminMiddleware := RequireAdmin()(dummyHandler)

	// 1. Unauthenticated request -> 401
	req1 := httptest.NewRequest("GET", "/analytics/summary", nil)
	rec1 := httptest.NewRecorder()
	adminMiddleware.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", rec1.Code)
	}

	// 2. Secret matches but non-admin role -> 403
	req2 := httptest.NewRequest("GET", "/analytics/summary", nil)
	req2.Header.Set("X-Internal-Secret", "test-secret-123")
	req2.Header.Set("X-User-Role", "user")
	rec2 := httptest.NewRecorder()
	adminMiddleware.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusForbidden {
		t.Errorf("expected status 403 for non-admin, got %d", rec2.Code)
	}

	// 3. Secret matches and admin role -> 200
	req3 := httptest.NewRequest("GET", "/analytics/summary", nil)
	req3.Header.Set("X-Internal-Secret", "test-secret-123")
	req3.Header.Set("X-User-Role", "admin")
	rec3 := httptest.NewRecorder()
	adminMiddleware.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Errorf("expected status 200 for valid admin, got %d", rec3.Code)
	}

	// 4. Forged Bearer token -> 401
	req4 := httptest.NewRequest("GET", "/analytics/summary", nil)
	req4.Header.Set("Authorization", "Bearer fake.token.here")
	rec4 := httptest.NewRecorder()
	adminMiddleware.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 for forged token, got %d", rec4.Code)
	}

	// 5. Machine-to-machine internal call with no user headers -> 200
	req5 := httptest.NewRequest("GET", "/analytics/summary", nil)
	req5.Header.Set("X-Internal-Secret", "test-secret-123")
	rec5 := httptest.NewRecorder()
	adminMiddleware.ServeHTTP(rec5, req5)
	if rec5.Code != http.StatusOK {
		t.Errorf("expected status 200 for machine-to-machine, got %d", rec5.Code)
	}
}
