package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestExtractUserID(t *testing.T) {
	os.Setenv("INTERNAL_SERVICE_SECRET", "test-internal-secret-123")
	os.Setenv("CLERK_JWT_HMAC_KEY", "test-hmac-key-fixture")
	defer func() {
		os.Unsetenv("INTERNAL_SERVICE_SECRET")
		os.Unsetenv("CLERK_JWT_HMAC_KEY")
		os.Unsetenv("NOTIFICATION_DEV_AUTH_BYPASS")
	}()

	// 1. Direct X-User-ID header with valid internal secret
	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req1.Header.Set("X-User-ID", "user_abc123")
	req1.Header.Set("X-Internal-Secret", "test-internal-secret-123")
	if uid := ExtractUserID(req1); uid != "user_abc123" {
		t.Errorf("expected user_abc123, got %s", uid)
	}

	// 1b. Direct X-User-ID header without internal secret (rejected without dev bypass)
	req1b := httptest.NewRequest(http.MethodGet, "/test", nil)
	req1b.Header.Set("X-User-ID", "user_abc123")
	if uid := ExtractUserID(req1b); uid != "" {
		t.Errorf("expected empty string without internal secret or dev bypass, got %s", uid)
	}

	// 2. Query param ?user_id= on WebSocket path /ws with dev bypass
	os.Setenv("NOTIFICATION_DEV_AUTH_BYPASS", "true")
	req2 := httptest.NewRequest(http.MethodGet, "/ws?user_id=user_query99", nil)
	if uid := ExtractUserID(req2); uid != "user_query99" {
		t.Errorf("expected user_query99, got %s", uid)
	}

	// 2b. Query param ?user_id= is ignored on general HTTP endpoints
	req2b := httptest.NewRequest(http.MethodGet, "/notifications?user_id=attacker", nil)
	if uid := ExtractUserID(req2b); uid != "" {
		t.Errorf("expected empty user ID for query param on HTTP endpoint, got %s", uid)
	}

	// 3. Properly signed HS256 JWT with sub claim using CLERK_JWT_HMAC_KEY fixture
	headerJSON, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	encodedHeader := base64.RawURLEncoding.EncodeToString(headerJSON)
	claimsJSON, _ := json.Marshal(map[string]any{"sub": "user_jwt_sub_777", "exp": 9999999999})
	encodedPayload := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signedData := encodedHeader + "." + encodedPayload
	mac := hmac.New(sha256.New, []byte("test-hmac-key-fixture"))
	mac.Write([]byte(signedData))
	encodedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	validJWT := signedData + "." + encodedSig

	req3 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req3.Header.Set("Authorization", "Bearer "+validJWT)
	if uid := ExtractUserID(req3); uid != "user_jwt_sub_777" {
		t.Errorf("expected user_jwt_sub_777, got %s", uid)
	}

	// 3b. Forged signature is rejected
	req3b := httptest.NewRequest(http.MethodGet, "/test", nil)
	req3b.Header.Set("Authorization", "Bearer "+signedData+".forged_sig")
	if uid := ExtractUserID(req3b); uid != "" {
		t.Errorf("expected empty string for forged signature, got %s", uid)
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

	// Authorized request via trusted internal secret
	os.Setenv("INTERNAL_SERVICE_SECRET", "test-internal-secret-123")
	defer os.Unsetenv("INTERNAL_SERVICE_SECRET")

	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/notifications", nil)
	req2.Header.Set("X-User-ID", "user_valid_123")
	req2.Header.Set("X-Internal-Secret", "test-internal-secret-123")
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Errorf("expected status %d for authenticated request, got %d", http.StatusOK, rec2.Code)
	}
	if rec2.Body.String() != "Authorized: user_valid_123" {
		t.Errorf("unexpected body: %s", rec2.Body.String())
	}
}
