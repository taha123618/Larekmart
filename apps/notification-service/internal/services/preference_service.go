package services

import (
	"context"
	"fmt"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/repositories"
)

type PreferenceService struct {
	repo *repositories.PreferenceRepository
}

func NewPreferenceService(repo *repositories.PreferenceRepository) *PreferenceService {
	return &PreferenceService{repo: repo}
}

func (s *PreferenceService) GetUserPreferences(ctx context.Context, userID string) (models.UserPreferencesMap, error) {
	if userID == "" {
		return nil, fmt.Errorf("user ID cannot be empty")
	}
	return s.repo.FindByUserID(ctx, userID)
}

func (s *PreferenceService) UpdatePreference(ctx context.Context, pref *models.NotificationPreference) error {
	if pref.UserID == "" || pref.NotificationType == "" {
		return fmt.Errorf("user ID and notification type are required")
	}
	return s.repo.Upsert(ctx, pref)
}

// ShouldSendChannel checks whether the user has enabled a specific channel for a notification type.
func (s *PreferenceService) ShouldSendChannel(ctx context.Context, userID, notifType string, channel models.ChannelType) (bool, error) {
	pref, err := s.repo.GetUserPreferenceForType(ctx, userID, notifType)
	if err != nil {
		return false, err
	}

	switch channel {
	case models.ChannelEmail:
		return pref.EmailEnabled, nil
	case models.ChannelSMS:
		return pref.SMSEnabled, nil
	case models.ChannelPush:
		return pref.PushEnabled, nil
	case models.ChannelInApp:
		return pref.InAppEnabled, nil
	default:
		return true, nil
	}
}
