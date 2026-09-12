package sms

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

// Provider defines the interface for low-level SMS delivery gateways.
type Provider interface {
	SendSMS(ctx context.Context, to, from, body string) error
}

// MockProvider is an in-memory/console provider for local development and testing.
type MockProvider struct {
	logger *observability.Logger
}

func NewMockProvider(logger *observability.Logger) *MockProvider {
	return &MockProvider{logger: logger}
}

func (m *MockProvider) SendSMS(ctx context.Context, to, from, body string) error {
	m.logger.Info(ctx, fmt.Sprintf("[Mock SMS] Sent from %s to %s: %s", from, to, body), map[string]interface{}{
		"provider": "mock",
		"to":       to,
	})
	return nil
}

// TwilioProvider implements SMS delivery via Twilio REST API.
type TwilioProvider struct {
	AccountSID string
	AuthToken  string
	FromNumber string
	HTTPClient *http.Client
	BaseURL    string
	logger     *observability.Logger
}

func NewTwilioProvider(accountSID, authToken, fromNumber string, logger *observability.Logger) *TwilioProvider {
	return &TwilioProvider{
		AccountSID: accountSID,
		AuthToken:  authToken,
		FromNumber: fromNumber,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
		BaseURL:    "https://api.twilio.com",
		logger:     logger,
	}
}

func (t *TwilioProvider) SendSMS(ctx context.Context, to, from, body string) error {
	if t.AccountSID == "" || t.AuthToken == "" {
		return fmt.Errorf("twilio credentials not configured (missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)")
	}

	sender := from
	if sender == "" {
		sender = t.FromNumber
	}
	if sender == "" {
		return fmt.Errorf("twilio sender phone number not configured")
	}

	apiURL := fmt.Sprintf("%s/2010-04-01/Accounts/%s/Messages.json", t.BaseURL, t.AccountSID)

	data := url.Values{}
	data.Set("To", to)
	data.Set("From", sender)
	data.Set("Body", body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create Twilio HTTP request: %w", err)
	}

	req.SetBasicAuth(t.AccountSID, t.AuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := t.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("twilio request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("twilio API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	t.logger.Info(ctx, fmt.Sprintf("Twilio SMS sent to %s from %s", to, sender), map[string]interface{}{
		"provider": "twilio",
		"to":       to,
		"from":     sender,
	})

	return nil
}

// SMSChannel handles SMS delivery using a configured provider.
type SMSChannel struct {
	provider     Provider
	senderNumber string
	logger       *observability.Logger
}

func NewSMSChannel(provider Provider, senderNumber string, logger *observability.Logger) *SMSChannel {
	return &SMSChannel{
		provider:     provider,
		senderNumber: senderNumber,
		logger:       logger,
	}
}

func (c *SMSChannel) Name() models.ChannelType {
	return models.ChannelSMS
}

func (c *SMSChannel) Send(ctx context.Context, delivery *models.NotificationDelivery, n *models.Notification) error {
	if delivery.Recipient == "" {
		return fmt.Errorf("missing recipient phone number for SMS delivery %s", delivery.ID)
	}

	start := time.Now()
	c.logger.Debug(ctx, "Sending SMS notification", map[string]interface{}{
		"to":              delivery.Recipient,
		"notification_id": n.ID,
	})

	err := c.provider.SendSMS(ctx, delivery.Recipient, c.senderNumber, n.Body)
	if err != nil {
		c.logger.Error(ctx, "Failed to send SMS", err, map[string]interface{}{
			"to":          delivery.Recipient,
			"duration_ms": time.Since(start).Milliseconds(),
		})
		return err
	}

	c.logger.Info(ctx, fmt.Sprintf("SMS delivered successfully to %s", delivery.Recipient), map[string]interface{}{
		"duration_ms": time.Since(start).Milliseconds(),
		"delivery_id": delivery.ID,
	})
	return nil
}
