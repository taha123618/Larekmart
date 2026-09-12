package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/services"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/templates"
)

func TestTemplatesHandler(t *testing.T) {
	engine := templates.NewEngine()
	templateSvc := services.NewTemplateService(nil, engine)
	handler := NewTemplatesHandler(templateSvc)

	req := httptest.NewRequest(http.MethodGet, "/notifications/templates", nil)
	rec := httptest.NewRecorder()

	handler.ListTemplates(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}
