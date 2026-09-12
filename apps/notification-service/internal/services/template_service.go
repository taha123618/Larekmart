package services

import (
	"context"
	"fmt"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/repositories"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/templates"
)

type RenderedNotification struct {
	Subject string
	Body    string
}

type TemplateService struct {
	repo   *repositories.TemplateRepository
	engine *templates.Engine
}

func NewTemplateService(repo *repositories.TemplateRepository, engine *templates.Engine) *TemplateService {
	return &TemplateService{
		repo:   repo,
		engine: engine,
	}
}

// Render compiles and renders a notification's title and body for a specific channel.
func (s *TemplateService) Render(ctx context.Context, templateName string, channel models.ChannelType, data interface{}) (*RenderedNotification, error) {
	tmpl, err := s.repo.FindByNameAndChannel(ctx, templateName, channel)
	if err != nil {
		return nil, fmt.Errorf("error fetching template %s: %w", templateName, err)
	}

	if tmpl == nil {
		// Fallback: simple default rendering if no database template exists
		return &RenderedNotification{
			Subject: fmt.Sprintf("Notification: %s", templateName),
			Body:    fmt.Sprintf("Update for %s", templateName),
		}, nil
	}

	body, err := s.engine.RenderText(tmpl.BodyTemplate, data)
	if err != nil {
		return nil, fmt.Errorf("failed to render body template: %w", err)
	}

	subject := ""
	if tmpl.Subject != nil && *tmpl.Subject != "" {
		renderedSubject, err := s.engine.RenderText(*tmpl.Subject, data)
		if err == nil {
			subject = renderedSubject
		} else {
			subject = *tmpl.Subject
		}
	}

	return &RenderedNotification{
		Subject: subject,
		Body:    body,
	}, nil
}

// ListTemplates returns all active templates.
func (s *TemplateService) ListTemplates(ctx context.Context) ([]*models.NotificationTemplate, error) {
	return s.repo.ListAll(ctx)
}
