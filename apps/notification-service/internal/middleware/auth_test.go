package middleware

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractUserID(t *testing.T) {
	// 1. Direct X-User-ID header
	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req1.Header.Set("X-User-ID", "user_abc123")
	if uid := ExtractUserID(req1); uid != "user_abc123" {
		t.Errorf("expected user_abc123, got %s", uid)
	}

	// 2. Query param ?user_id= is accepted on WebSocket path /ws
	req2 := httptest.NewRequest(http.MethodGet, "/ws?user_id=user_query99", nil)
	if uid := ExtractUserID(req2); uid != "user_query99" {
		t.Errorf("expected user_query99, got %s", uid)
	}

	// 2b. Query param ?user_id= is ignored on general HTTP endpoints
	req2b := httptest.NewRequest(http.MethodGet, "/notifications?user_id=attacker", nil)
	if uid := ExtractUserID(req2b); uid != "" {
		t.Errorf("expected empty user ID for query param on HTTP endpoint, got %s", uid)
	}

	// 3. JWT token with sub claim
	claims := map[string]string{"sub": "user_jwt_sub_777"}
	claimsBytes, _ := json.Marshal(claims)
	encodedPayload := base64.RawURLEncoding.EncodeToString(claimsBytes)
	fakeJWT := "header." + encodedPayload + ".signature"

	req3 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req3.Header.Set("Authorization", "Bearer "+fakeJWT)
	if uid := ExtractUserID(req3); uid != "user_jwt_sub_777" {
		t.Errorf("expected user_jwt_sub_777, got %s", uid)
	}

	// 4. Empty auth header returns empty string
	req4 := httptest.NewRequest(http.MethodGet, "/test", nil)
	if uid := ExtractUserID(req4); uid != "" {
		t.Errorf("expected empty user ID, got %s", uid)
	}
}

func TestRequireAuth_Middleware(t *testing.T) {
	handler := RequireAuth()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid := GetUserID(r.Context())
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("Authorized: " + uid))
	}))

	// Unauthorized request
	rec1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/notifications", nil)
	handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d for unauthenticated request, got %d", http.StatusUnauthorized, rec1.Code)
	}

	// Authorized request
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/notifications", nil)
	req2.Header.Set("X-User-ID", "user_valid_123")
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Errorf("expected status %d for authenticated request, got %d", http.StatusOK, rec2.Code)
	}
	if rec2.Body.String() != "Authorized: user_valid_123" {
		t.Errorf("unexpected body: %s", rec2.Body.String())
	}
}
