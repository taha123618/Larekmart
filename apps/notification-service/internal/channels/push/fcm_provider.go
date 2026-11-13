package push

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"sync"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
	"google.golang.org/api/option"
)

// ErrInvalidDeviceToken indicates that the FCM device token is unregistered or invalid.
var ErrInvalidDeviceToken = errors.New("fcm: invalid or unregistered device token")

// FCMProvider implements the Provider interface for Firebase Cloud Messaging.
type FCMProvider struct {
	logger        *observability.Logger
	credJSONPath  string
	credBase64    string
	mu            sync.Mutex
	client        *messaging.Client
	app           *firebase.App
	isInitialized bool
}

// NewFCMProvider initializes an FCMProvider with environment variables or explicit paths.
func NewFCMProvider(credJSONPath, credBase64 string, logger *observability.Logger) *FCMProvider {
	if credJSONPath == "" {
		credJSONPath = os.Getenv("FCM_CREDENTIALS_JSON")
	}
	if credBase64 == "" {
		credBase64 = os.Getenv("FCM_CREDENTIALS_BASE64")
	}
	return &FCMProvider{
		logger:       logger,
		credJSONPath: credJSONPath,
		credBase64:   credBase64,
	}
}

func (f *FCMProvider) initClient(ctx context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.isInitialized && f.client != nil {
		return nil
	}

	var opt option.ClientOption
	if f.credBase64 != "" {
		decoded, err := base64.StdEncoding.DecodeString(f.credBase64)
		if err != nil {
			return fmt.Errorf("failed to decode FCM_CREDENTIALS_BASE64: %w", err)
		}
		opt = option.WithCredentialsJSON(decoded)
	} else if f.credJSONPath != "" {
		opt = option.WithCredentialsFile(f.credJSONPath)
	} else {
		return errors.New("fcm credentials not provided: set FCM_CREDENTIALS_JSON or FCM_CREDENTIALS_BASE64")
	}

	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return fmt.Errorf("failed to initialize firebase app: %w", err)
	}

	client, err := app.Messaging(ctx)
	if err != nil {
		return fmt.Errorf("failed to initialize firebase messaging client: %w", err)
	}

	f.app = app
	f.client = client
	f.isInitialized = true
	f.logger.Info(ctx, "FCM messaging client initialized successfully")
	return nil
}

// SendPush sends a push notification to an FCM device token.
func (f *FCMProvider) SendPush(ctx context.Context, deviceToken, title, body string, data map[string]interface{}) error {
	if err := f.initClient(ctx); err != nil {
		return fmt.Errorf("fcm provider initialization failed: %w", err)
	}

	stringData := make(map[string]string)
	for k, v := range data {
		stringData[k] = fmt.Sprintf("%v", v)
	}

	msg := &messaging.Message{
		Token: deviceToken,
		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},
		Data: stringData,
	}

	response, err := f.client.Send(ctx, msg)
	if err != nil {
		if messaging.IsRegistrationTokenNotRegistered(err) || messaging.IsInvalidArgument(err) {
			f.logger.Warn(ctx, "FCM token invalid or unregistered", map[string]interface{}{
				"token": deviceToken,
				"error": err.Error(),
			})
			return fmt.Errorf("%w: %v", ErrInvalidDeviceToken, err)
		}
		f.logger.Error(ctx, "FCM send error", err, map[string]interface{}{
			"token": deviceToken,
		})
		return fmt.Errorf("fcm delivery failed: %w", err)
	}

	f.logger.Debug(ctx, "FCM message sent successfully", map[string]interface{}{
		"message_id": response,
		"token":      deviceToken,
	})
	return nil
}
