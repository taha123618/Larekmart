package push

import (
	"context"
	"crypto/ecdsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"

	"github.com/sideshow/apns2"
	"github.com/sideshow/apns2/payload"
	"github.com/sideshow/apns2/token"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

// ErrInvalidAPNSToken indicates that the APNS device token is unregistered or bad.
var ErrInvalidAPNSToken = errors.New("apns: invalid or unregistered device token")

// APNSConfig holds configuration parameters for the Apple Push Notification service.
type APNSConfig struct {
	KeyPath   string
	KeyBase64 string
	KeyID     string
	TeamID    string
	BundleID  string
	IsProd    bool
}

// APNSProvider implements the Provider interface for Apple Push Notification service (APNS).
type APNSProvider struct {
	logger        *observability.Logger
	cfg           APNSConfig
	mu            sync.Mutex
	client        *apns2.Client
	isInitialized bool
}

// NewAPNSProvider creates an APNSProvider. If config values are empty, they are read from env.
func NewAPNSProvider(cfg APNSConfig, logger *observability.Logger) *APNSProvider {
	if cfg.KeyPath == "" {
		cfg.KeyPath = os.Getenv("APNS_KEY_PATH")
	}
	if cfg.KeyBase64 == "" {
		cfg.KeyBase64 = os.Getenv("APNS_KEY_BASE64")
	}
	if cfg.KeyID == "" {
		cfg.KeyID = os.Getenv("APNS_KEY_ID")
	}
	if cfg.TeamID == "" {
		cfg.TeamID = os.Getenv("APNS_TEAM_ID")
	}
	if cfg.BundleID == "" {
		cfg.BundleID = os.Getenv("APNS_BUNDLE_ID")
	}
	if os.Getenv("APP_ENV") == "production" {
		cfg.IsProd = true
	}

	return &APNSProvider{
		logger: logger,
		cfg:    cfg,
	}
}

func (a *APNSProvider) initClient(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.isInitialized && a.client != nil {
		return nil
	}

	if a.cfg.KeyID == "" || a.cfg.TeamID == "" {
		return errors.New("apns credentials incomplete: APNS_KEY_ID and APNS_TEAM_ID are required")
	}

	var authKey *ecdsa.PrivateKey
	var err error

	if a.cfg.KeyBase64 != "" {
		keyBytes, decodeErr := base64.StdEncoding.DecodeString(a.cfg.KeyBase64)
		if decodeErr != nil {
			return fmt.Errorf("failed to decode APNS_KEY_BASE64: %w", decodeErr)
		}
		authKey, err = token.AuthKeyFromBytes(keyBytes)
		if err != nil {
			return fmt.Errorf("failed to parse APNS auth key from bytes: %w", err)
		}
	} else if a.cfg.KeyPath != "" {
		authKey, err = token.AuthKeyFromFile(a.cfg.KeyPath)
		if err != nil {
			return fmt.Errorf("failed to load APNS auth key from file %s: %w", a.cfg.KeyPath, err)
		}
	} else {
		return errors.New("apns key not provided: set APNS_KEY_PATH or APNS_KEY_BASE64")
	}

	tokenSource := &token.Token{
		AuthKey: authKey,
		KeyID:   a.cfg.KeyID,
		TeamID:  a.cfg.TeamID,
	}

	client := apns2.NewTokenClient(tokenSource)
	if a.cfg.IsProd {
		client.Production()
	} else {
		client.Development()
	}

	a.client = client
	a.isInitialized = true
	a.logger.Info(ctx, "APNS client initialized successfully", map[string]interface{}{
		"production": a.cfg.IsProd,
		"bundle_id":  a.cfg.BundleID,
	})

	return nil
}

// SendPush sends an Apple push notification to a device token.
func (a *APNSProvider) SendPush(ctx context.Context, deviceToken, title, body string, data map[string]interface{}) error {
	if err := a.initClient(ctx); err != nil {
		return fmt.Errorf("apns provider initialization failed: %w", err)
	}

	p := payload.NewPayload().AlertTitle(title).AlertBody(body).Sound("default")
	for k, v := range data {
		p.Custom(k, v)
	}

	payloadBytes, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("failed to marshal apns payload: %w", err)
	}

	notification := &apns2.Notification{
		DeviceToken: deviceToken,
		Topic:       a.cfg.BundleID,
		Payload:     payloadBytes,
	}

	res, err := a.client.PushWithContext(ctx, notification)
	if err != nil {
		a.logger.Error(ctx, "APNS transport error", err, map[string]interface{}{
			"token": deviceToken,
		})
		return fmt.Errorf("apns request failed: %w", err)
	}

	if !res.Sent() {
		a.logger.Warn(ctx, "APNS push rejected by Apple gateway", map[string]interface{}{
			"status_code": res.StatusCode,
			"reason":      res.Reason,
			"apns_id":     res.ApnsID,
			"token":       deviceToken,
		})
		if res.Reason == apns2.ReasonBadDeviceToken ||
			res.Reason == apns2.ReasonUnregistered ||
			res.Reason == apns2.ReasonDeviceTokenNotForTopic {
			return fmt.Errorf("%w: %s (status %d)", ErrInvalidAPNSToken, res.Reason, res.StatusCode)
		}
		return fmt.Errorf("apns push delivery failed: %s (status %d)", res.Reason, res.StatusCode)
	}

	a.logger.Debug(ctx, "APNS push notification sent successfully", map[string]interface{}{
		"apns_id": res.ApnsID,
		"token":   deviceToken,
	})

	return nil
}
