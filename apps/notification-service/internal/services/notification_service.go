package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/repositories"
)

type CreateNotificationInput struct {
	UserID        string
	Type          string
	Title         string
	Body          string
	RecipientEmail string
	RecipientPhone string
	Metadata      map[string]interface{}
	Priority      models.NotificationPriority
}

type NotificationService struct {
	notificationRepo *repositories.NotificationRepository
	preferenceSvc    *PreferenceService
	templateSvc      *TemplateService
	deliverySvc      *DeliveryService
	logger           *observability.Logger
	metrics          *observability.Metrics
}

func NewNotificationService(
	notificationRepo *repositories.NotificationRepository,
	preferenceSvc *PreferenceService,
	templateSvc *TemplateService,
	deliverySvc *DeliveryService,
	logger *observability.Logger,
	metrics *observability.Metrics,
) *NotificationService {
	return &NotificationService{
		notificationRepo: notificationRepo,
		preferenceSvc:    preferenceSvc,
		templateSvc:      templateSvc,
		deliverySvc:      deliverySvc,
		logger:           logger,
		metrics:          metrics,
	}
}

// ProcessAndDispatch evaluates user preferences, persists the notification and deliveries, and queues for worker delivery.
func (s *NotificationService) ProcessAndDispatch(ctx context.Context, input CreateNotificationInput) (*models.Notification, error) {
	if input.UserID == "" {
		return nil, fmt.Errorf("user_id is required")
	}
	if input.Type == "" {
		input.Type = "general"
	}
	if input.Priority == "" {
		input.Priority = models.PriorityNormal
	}
	if input.Metadata == nil {
		input.Metadata = make(map[string]interface{})
	}

	now := time.Now().UTC()
	notificationID := "notif_" + uuid.New().String()

	notification := &models.Notification{
		ID:        notificationID,
		UserID:    input.UserID,
		Type:      input.Type,
		Title:     input.Title,
		Body:      input.Body,
		Metadata:  input.Metadata,
		Priority:  input.Priority,
		Status:    models.StatusProcessing,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Determine applicable channels based on user preferences and provided contact information
	var deliveries []*models.NotificationDelivery

	// 1. In-App Channel (Always evaluated)
	if sendInApp, _ := s.preferenceSvc.ShouldSendChannel(ctx, input.UserID, input.Type, models.ChannelInApp); sendInApp {
		deliveries = append(deliveries, &models.NotificationDelivery{
			ID:             "del_inapp_" + uuid.New().String(),
			NotificationID: notificationID,
			Channel:        models.ChannelInApp,
			Recipient:      input.UserID,
			Status:         models.DeliveryPending,
			Attempts:       0,
			MaxAttempts:    3,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}

	// 2. Email Channel
	if input.RecipientEmail != "" {
		if sendEmail, _ := s.preferenceSvc.ShouldSendChannel(ctx, input.UserID, input.Type, models.ChannelEmail); sendEmail {
			deliveries = append(deliveries, &models.NotificationDelivery{
				ID:             "del_email_" + uuid.New().String(),
				NotificationID: notificationID,
				Channel:        models.ChannelEmail,
				Recipient:      input.RecipientEmail,
				Status:         models.DeliveryPending,
				Attempts:       0,
				MaxAttempts:    3,
				CreatedAt:      now,
				UpdatedAt:      now,
			})
		}
	}

	// 3. SMS Channel
	if input.RecipientPhone != "" {
		if sendSMS, _ := s.preferenceSvc.ShouldSendChannel(ctx, input.UserID, input.Type, models.ChannelSMS); sendSMS {
			deliveries = append(deliveries, &models.NotificationDelivery{
				ID:             "del_sms_" + uuid.New().String(),
				NotificationID: notificationID,
				Channel:        models.ChannelSMS,
				Recipient:      input.RecipientPhone,
				Status:         models.DeliveryPending,
				Attempts:       0,
				MaxAttempts:    3,
				CreatedAt:      now,
				UpdatedAt:      now,
			})
		}
	}

	// 4. Push Channel
	if sendPush, _ := s.preferenceSvc.ShouldSendChannel(ctx, input.UserID, input.Type, models.ChannelPush); sendPush {
		deliveries = append(deliveries, &models.NotificationDelivery{
			ID:             "del_push_" + uuid.New().String(),
			NotificationID: notificationID,
			Channel:        models.ChannelPush,
			Recipient:      input.UserID,
			Status:         models.DeliveryPending,
			Attempts:       0,
			MaxAttempts:    3,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}

	notification.Deliveries = deliveries

	// Persist to PostgreSQL
	err := s.notificationRepo.Create(ctx, notification)
	if err != nil {
		s.logger.Error(ctx, "Failed to persist notification", err, map[string]interface{}{
			"user_id": input.UserID,
			"type":    input.Type,
		})
		return nil, fmt.Errorf("failed to save notification: %w", err)
	}

	if s.metrics != nil {
		s.metrics.NotificationsCreated.WithLabelValues(input.Type, string(input.Priority)).Inc()
	}

	// Queue deliveries to worker pool
	err = s.deliverySvc.QueueDelivery(ctx, notification)
	if err != nil {
		s.logger.Error(ctx, "Failed to queue delivery to worker pool", err, map[string]interface{}{
			"notification_id": notification.ID,
		})
	}

	s.logger.Info(ctx, fmt.Sprintf("Notification %s created with %d delivery channels", notification.ID, len(deliveries)), map[string]interface{}{
		"notification_id": notification.ID,
		"user_id":         notification.UserID,
		"channel_count":   len(deliveries),
	})

	return notification, nil
}

func (s *NotificationService) GetUserNotifications(ctx context.Context, userID string, limit, offset int) ([]*models.Notification, error) {
	return s.notificationRepo.FindByUserID(ctx, userID, limit, offset)
}

func (s *NotificationService) GetUnreadNotifications(ctx context.Context, userID string, limit int) ([]*models.Notification, int, error) {
	return s.notificationRepo.FindUnreadByUserID(ctx, userID, limit)
}

func (s *NotificationService) MarkAsRead(ctx context.Context, id, userID string) (bool, error) {
	return s.notificationRepo.MarkAsRead(ctx, id, userID)
}

func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID string) (int64, error) {
	return s.notificationRepo.MarkAllAsRead(ctx, userID)
}
