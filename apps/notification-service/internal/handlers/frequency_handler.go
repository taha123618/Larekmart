package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
)

// FrequencyHandler exposes HTTP endpoints for user notification frequency controls,
// digest flushing, and delivery retry visibility.
type FrequencyHandler struct {
	mgr *services.FrequencyDigestManager
}

func NewFrequencyHandler(mgr *services.FrequencyDigestManager) *FrequencyHandler {
	return &FrequencyHandler{mgr: mgr}
}

func (h *FrequencyHandler) SetPolicy(w http.ResponseWriter, r *http.Request) {
	var policy services.FrequencyPolicy
	if err := json.NewDecoder(r.Body).Decode(&policy); err != nil || policy.UserID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "userId and valid JSON policy are required"})
		return
	}
	h.mgr.SetPolicy(policy)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"policy": policy})
}

func (h *FrequencyHandler) EvaluateDispatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID         string `json:"userId"`
		Channel        string `json:"channel"`
		NotificationID string `json:"notificationId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" || body.NotificationID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "userId, channel, and notificationId are required"})
		return
	}
	decision := h.mgr.EvaluateDispatch(body.UserID, body.Channel, body.NotificationID, time.Now().UTC())
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"decision": decision})
}

func (h *FrequencyHandler) FlushDigest(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	items := h.mgr.FlushDigest(userID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"userId": userID, "items": items})
}

func (h *FrequencyHandler) GetRetryStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rec, ok := h.mgr.GetRetryStatus(id)
	w.Header().Set("Content-Type", "application/json")
	if !ok {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "Retry record not found"})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"retry": rec})
}
