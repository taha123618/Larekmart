package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

// Recoverer catches panics and returns 500 JSON without crashing the server.
func Recoverer(log *observability.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rvr := recover(); rvr != nil {
					stack := string(debug.Stack())
					log.Error(r.Context(), fmt.Sprintf("HTTP handler panic: %v", rvr), nil, map[string]interface{}{
						"stack": stack,
						"path":  r.URL.Path,
					})

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(map[string]string{
						"message": "Internal Server Error",
					})
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
