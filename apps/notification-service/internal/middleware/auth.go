package middleware

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// RequireAuth ensures that a valid user identity is attached to the request.
func RequireAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := ExtractUserID(r)
			if userID == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"message": "Unauthorized: user identity required",
				})
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth extracts user identity if available without blocking unauthenticated requests.
func OptionalAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := ExtractUserID(r)
			if userID != "" {
				ctx := context.WithValue(r.Context(), UserIDKey, userID)
				r = r.WithContext(ctx)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserID retrieves the extracted UserID from the request context.
func GetUserID(ctx context.Context) string {
	if val := ctx.Value(UserIDKey); val != nil {
		if s, ok := val.(string); ok {
			return s
		}
	}
	return ""
}

// ExtractUserID retrieves user identifier from headers, query params (for WebSockets), or JWT payload.
func ExtractUserID(r *http.Request) string {
	internalSecret := os.Getenv("INTERNAL_SERVICE_SECRET")

	// 1. Direct header - trusted only if internal secret matches or if no secret is configured in development/test
	if uid := r.Header.Get("X-User-ID"); uid != "" {
		if internalSecret != "" {
			providedSecret := r.Header.Get("X-Internal-Secret")
			if subtle.ConstantTimeCompare([]byte(providedSecret), []byte(internalSecret)) == 1 {
				return uid
			}
		} else if os.Getenv("APP_ENV") != "production" {
			return uid
		}
	}

	// 2. Query parameter - strictly permitted only for WebSocket handshakes (/ws or Upgrade: websocket)
	isWS := strings.HasPrefix(r.URL.Path, "/ws") || strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
	if isWS {
		if uid := r.URL.Query().Get("user_id"); uid != "" {
			return uid
		}
	}

	// 3. Authorization Bearer token header (or token param for WebSockets)
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" && isWS {
		authHeader = r.URL.Query().Get("token")
	}

	if authHeader != "" {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) >= 2 {
			// Decode JWT payload without cryptographic verification for sub/userId
			payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
			if err == nil {
				var claims struct {
					Sub    string `json:"sub"`
					UserID string `json:"user_id"`
					ID     string `json:"id"`
				}
				if json.Unmarshal(payloadBytes, &claims) == nil {
					if claims.Sub != "" {
						return claims.Sub
					}
					if claims.UserID != "" {
						return claims.UserID
					}
					if claims.ID != "" {
						return claims.ID
					}
				}
			}
		}
	}

	return ""
}
