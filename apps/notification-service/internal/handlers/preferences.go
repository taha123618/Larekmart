package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/middleware"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
)

type PreferencesHandler struct {
	preferenceSvc *services.PreferenceService
}

func NewPreferencesHandler(svc *services.PreferenceService) *PreferencesHandler {
	return &PreferencesHandler{preferenceSvc: svc}
}

// GetPreferences returns all channel preferences for the authenticated user.
func (h *PreferencesHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, `{"message":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	prefs, err := h.preferenceSvc.GetUserPreferences(r.Context(), userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"user_id":     userID,
		"preferences": prefs,
	})
}

// UpdatePreferences creates or updates a user preference setting.
func (h *PreferencesHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, `{"message":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req models.NotificationPreference
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.NotificationType == "" {
		http.Error(w, `{"message":"notification_type is required in request body"}`, http.StatusBadRequest)
		return
	}
	req.UserID = userID

	if err := h.preferenceSvc.UpdatePreference(r.Context(), &req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"preference": req,
	})
}
