package middleware

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
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

// ExtractUserID retrieves user identifier from headers, query params (user_id/token), or JWT payload.
func ExtractUserID(r *http.Request) string {
	// 1. Direct header (e.g. from internal gateway or service call)
	if uid := r.Header.Get("X-User-ID"); uid != "" {
		return uid
	}

	// 2. Query parameter (e.g. for WebSocket connections ?token= or ?user_id=)
	if uid := r.URL.Query().Get("user_id"); uid != "" {
		return uid
	}

	// 3. Authorization Bearer token header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
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
