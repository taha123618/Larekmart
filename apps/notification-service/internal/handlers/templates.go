package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
)

type TemplatesHandler struct {
	templateSvc *services.TemplateService
}

func NewTemplatesHandler(svc *services.TemplateService) *TemplatesHandler {
	return &TemplatesHandler{templateSvc: svc}
}

// ListTemplates returns all active notification templates.
func (h *TemplatesHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := h.templateSvc.ListTemplates(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": templates,
		"count":     len(templates),
	})
}
