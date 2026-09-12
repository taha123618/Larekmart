package services

import (
	"context"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/templates"
)

func TestTemplateService_FallbackRendering(t *testing.T) {
	engine := templates.NewEngine()
	// With nil repository pointer, FindByNameAndChannel error or nil returns fallback
	svc := NewTemplateService(nil, engine)

	data := map[string]interface{}{
		"OrderID": "ORD-999",
		"Amount":  49.99,
	}

	rendered, err := svc.Render(context.Background(), "order.created", models.ChannelInApp, data)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if rendered.Subject == "" {
		t.Error("expected non-empty subject in fallback rendering")
	}
	if rendered.Body == "" {
		t.Error("expected non-empty body in fallback rendering")
	}
}
