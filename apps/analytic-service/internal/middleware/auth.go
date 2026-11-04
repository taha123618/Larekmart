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

type contextKey string

const (
	UserIDKey   contextKey = "userId"
	UserRoleKey contextKey = "userRole"
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

// RequireAdmin verifies that the caller has administrative privileges.
// Supports both API Gateway trusted header injection (with constant-time secret check)
// and direct Clerk JWT Bearer authentication.
func RequireAdmin(secret ...string) func(http.Handler) http.Handler {
	internalSecret := os.Getenv("INTERNAL_SERVICE_SECRET")
	if len(secret) > 0 && secret[0] != "" {
		internalSecret = secret[0]
	}
	if internalSecret == "" {
		internalSecret = "dev-shared-internal-secret-larekmart"
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			providedSecret := r.Header.Get("X-Internal-Secret")

			// Path A: Authenticated by API Gateway with validated transport secret
			if providedSecret != "" {
				if SafeTimingCompare(providedSecret, internalSecret) {
					role := strings.ToLower(r.Header.Get("X-User-Role"))
					uid := r.Header.Get("X-User-ID")

					// Machine-to-machine internal service call: no user identity asserted
					if role == "" && uid == "" {
						ctx := context.WithValue(r.Context(), UserRoleKey, "admin")
						ctx = context.WithValue(ctx, UserIDKey, "internal-service")
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}

					// Proxied user request: strictly require admin role
					if role == "admin" || role == "super_admin" {
						ctx := context.WithValue(r.Context(), UserRoleKey, role)
						if uid != "" {
							ctx = context.WithValue(ctx, UserIDKey, uid)
						}
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}

					// Valid secret but non-admin role -> 403 Forbidden
					writeJSONError(w, http.StatusForbidden, "Unauthorized: Admin access required!")
					return
				}
			}

			// Path B: Direct Clerk JWT Bearer Token validation
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				token := strings.TrimPrefix(authHeader, "Bearer ")
				if claims, ok := verifyClerkToken(token); ok {
					if claims.Role == "admin" || claims.Role == "super_admin" {
						ctx := context.WithValue(r.Context(), UserRoleKey, claims.Role)
						ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
					writeJSONError(w, http.StatusForbidden, "Unauthorized: Admin access required!")
					return
				}
			}

			// Path C: Non-production development bypass (requires explicit ANALYTIC_DEV_AUTH_BYPASS=true)
			isNonProd := os.Getenv("APP_ENV") != "production" && os.Getenv("NODE_ENV") != "production"
			if isNonProd && os.Getenv("ANALYTIC_DEV_AUTH_BYPASS") == "true" {
				if r.Header.Get("X-Dev-Role") == "admin" {
					ctx := context.WithValue(r.Context(), UserRoleKey, "admin")
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			writeJSONError(w, http.StatusUnauthorized, "You are not logged in!")
		})
	}
}

// RequireUser ensures a valid authenticated identity exists.
func RequireUser() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			internalSecret := os.Getenv("INTERNAL_SERVICE_SECRET")
			providedSecret := r.Header.Get("X-Internal-Secret")

			if internalSecret != "" && providedSecret != "" {
				if SafeTimingCompare(providedSecret, internalSecret) {
					uid := r.Header.Get("X-User-ID")
					if uid != "" {
						ctx := context.WithValue(r.Context(), UserIDKey, uid)
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
			}

			authHeader := r.Header.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				token := strings.TrimPrefix(authHeader, "Bearer ")
				if claims, ok := verifyClerkToken(token); ok {
					ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			// Non-production development bypass requires explicit flag
			isNonProd := os.Getenv("APP_ENV") != "production" && os.Getenv("NODE_ENV") != "production"
			if isNonProd && os.Getenv("ANALYTIC_DEV_AUTH_BYPASS") == "true" {
				if uid := r.Header.Get("X-User-ID"); uid != "" {
					ctx := context.WithValue(r.Context(), UserIDKey, uid)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			writeJSONError(w, http.StatusUnauthorized, "You are not logged in!")
		})
	}
}

type tokenClaims struct {
	UserID string
	Role   string
}

func verifyClerkToken(token string) (*tokenClaims, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, false
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, false
	}

	var header struct {
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, false
	}

	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, false
	}

	signedData := parts[0] + "." + parts[1]

	verified := false

	switch header.Alg {
	case "RS256":
		jwtKey := os.Getenv("CLERK_JWT_KEY")
		if jwtKey == "" {
			return nil, false
		}
		block, _ := pem.Decode([]byte(jwtKey))
		if block == nil {
			return nil, false
		}
		pubKey, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, false
		}
		rsaPub, ok := pubKey.(*rsa.PublicKey)
		if !ok {
			return nil, false
		}
		hashed := sha256.Sum256([]byte(signedData))
		err = rsa.VerifyPKCS1v15(rsaPub, crypto.SHA256, hashed[:], sigBytes)
		if err == nil {
			verified = true
		}

	case "HS256":
		// Only permitted via explicit test fixture key — never CLERK_SECRET_KEY
		hmacKey := os.Getenv("CLERK_JWT_HMAC_KEY")
		if hmacKey == "" {
			return nil, false
		}
		mac := hmac.New(sha256.New, []byte(hmacKey))
		mac.Write([]byte(signedData))
		expectedSig := mac.Sum(nil)
		if subtle.ConstantTimeCompare(sigBytes, expectedSig) == 1 {
			verified = true
		}

	default:
		return nil, false
	}

	if !verified {
		return nil, false
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, false
	}

	var payload struct {
		Sub      string `json:"sub"`
		UserID   string `json:"user_id"`
		Exp      int64  `json:"exp"`
		Nbf      int64  `json:"nbf"`
		Role     string `json:"role"`
		Metadata struct {
			Role string `json:"role"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, false
	}

	now := time.Now().Unix()
	if payload.Exp > 0 && now > payload.Exp {
		return nil, false
	}
	if payload.Nbf > 0 && now < payload.Nbf {
		return nil, false
	}

	uid := payload.Sub
	if uid == "" {
		uid = payload.UserID
	}
	role := payload.Metadata.Role
	if role == "" {
		role = payload.Role
	}
	if role == "" {
		role = "user"
	}

	return &tokenClaims{
		UserID: uid,
		Role:   role,
	}, true
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": msg})
}
