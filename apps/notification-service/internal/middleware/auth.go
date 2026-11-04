package middleware

import (
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"os"
	"strings"
	"time"
)

// SafeTimingCompare compares two strings in constant time using SHA-256 pre-hashing
// to eliminate timing and secret-length side-channels.
func SafeTimingCompare(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	hashA := sha256.Sum256([]byte(a))
	hashB := sha256.Sum256([]byte(b))
	return subtle.ConstantTimeCompare(hashA[:], hashB[:]) == 1
}

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
	isNonProd := os.Getenv("APP_ENV") != "production" && os.Getenv("ENV") != "production" && os.Getenv("NODE_ENV") != "production"
	isDevAuthBypass := isNonProd && os.Getenv("NOTIFICATION_DEV_AUTH_BYPASS") == "true"

	// 1. Direct header - trusted if internal secret matches (via gateway) or explicit dev auth bypass
	if uid := r.Header.Get("X-User-ID"); uid != "" {
		if internalSecret != "" {
			providedSecret := r.Header.Get("X-Internal-Secret")
			if SafeTimingCompare(providedSecret, internalSecret) {
				return uid
			}
		}
		if isDevAuthBypass {
			return uid
		}
	}

	// 2. Query parameter - strictly permitted only for WebSocket handshakes with explicit dev bypass
	isWS := strings.HasPrefix(r.URL.Path, "/ws") || strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
	if isWS {
		if uid := r.URL.Query().Get("user_id"); uid != "" {
			if isDevAuthBypass {
				return uid
			}
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
		if len(parts) == 3 {
			headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
			if err != nil {
				return ""
			}

			var header struct {
				Alg string `json:"alg"`
			}
			if err := json.Unmarshal(headerBytes, &header); err != nil {
				return ""
			}

			sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
			if err != nil {
				return ""
			}

			signedData := parts[0] + "." + parts[1]
			verified := false

			switch header.Alg {
			case "RS256":
				jwtKey := os.Getenv("CLERK_JWT_KEY")
				if jwtKey == "" {
					return ""
				}
				block, _ := pem.Decode([]byte(jwtKey))
				if block == nil {
					return ""
				}
				pubKey, err := x509.ParsePKIXPublicKey(block.Bytes)
				if err != nil {
					return ""
				}
				rsaPub, ok := pubKey.(*rsa.PublicKey)
				if !ok {
					return ""
				}
				hashed := sha256.Sum256([]byte(signedData))
				if rsa.VerifyPKCS1v15(rsaPub, crypto.SHA256, hashed[:], sigBytes) == nil {
					verified = true
				}

			case "HS256":
				// Only permitted via explicit test fixture key — never CLERK_SECRET_KEY
				hmacKey := os.Getenv("CLERK_JWT_HMAC_KEY")
				if hmacKey == "" {
					return ""
				}
				mac := hmac.New(sha256.New, []byte(hmacKey))
				mac.Write([]byte(signedData))
				expectedSig := mac.Sum(nil)
				if subtle.ConstantTimeCompare(sigBytes, expectedSig) == 1 {
					verified = true
				}

			default:
				return ""
			}

			if !verified {
				return ""
			}

			payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
			if err == nil {
				var claims struct {
					Sub    string `json:"sub"`
					UserID string `json:"user_id"`
					ID     string `json:"id"`
					Exp    int64  `json:"exp"`
					Nbf    int64  `json:"nbf"`
				}
				if json.Unmarshal(payloadBytes, &claims) == nil {
					now := time.Now().Unix()
					if claims.Exp > 0 && now > claims.Exp {
						return ""
					}
					if claims.Nbf > 0 && now < claims.Nbf {
						return ""
					}
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
