package sms

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
	"github.com/taha123618/Larekmart/apps/notification-service/internal/observability"
)

type testSMSProvider struct {
	shouldFail bool
	lastTo     string
	lastBody   string
}

func (p *testSMSProvider) SendSMS(ctx context.Context, to, from, body string) error {
	if p.shouldFail {
		return errors.New("provider gateway network timeout")
	}
	p.lastTo = to
	p.lastBody = body
	return nil
}

func TestSMSChannel_Send(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")

	t.Run("Successful send", func(t *testing.T) {
		provider := &testSMSProvider{}
		channel := NewSMSChannel(provider, "+19999999999", logger)

		delivery := &models.NotificationDelivery{
			ID:        "del_1",
			Recipient: "+1234567890",
		}
		notification := &models.Notification{
			ID:   "notif_1",
			Body: "Your order has shipped!",
		}

		err := channel.Send(context.Background(), delivery, notification)
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}

		if provider.lastTo != "+1234567890" {
			t.Errorf("expected to=%s, got %s", "+1234567890", provider.lastTo)
		}
		if provider.lastBody != "Your order has shipped!" {
			t.Errorf("expected body=%s, got %s", "Your order has shipped!", provider.lastBody)
		}
	})

	t.Run("Missing recipient error", func(t *testing.T) {
		provider := &testSMSProvider{}
		channel := NewSMSChannel(provider, "+19999999999", logger)

		delivery := &models.NotificationDelivery{
			ID:        "del_2",
			Recipient: "",
		}
		notification := &models.Notification{
			ID:   "notif_2",
			Body: "Test",
		}

		err := channel.Send(context.Background(), delivery, notification)
		if err == nil {
			t.Fatal("expected error on missing recipient, got nil")
		}
	})

	t.Run("Provider error propagated", func(t *testing.T) {
		provider := &testSMSProvider{shouldFail: true}
		channel := NewSMSChannel(provider, "+19999999999", logger)

		delivery := &models.NotificationDelivery{
			ID:        "del_3",
			Recipient: "+1234567890",
		}
		notification := &models.Notification{
			ID:   "notif_3",
			Body: "Test",
		}

		err := channel.Send(context.Background(), delivery, notification)
		if err == nil {
			t.Fatal("expected provider error, got nil")
		}
	})
}

func TestTwilioProvider(t *testing.T) {
	logger := observability.NewLogger("test", "test", "debug", "pretty")

	t.Run("Validation errors", func(t *testing.T) {
		pNoCreds := NewTwilioProvider("", "", "+1234567890", logger)
		if err := pNoCreds.SendSMS(context.Background(), "+19998887777", "", "Test"); err == nil {
			t.Error("expected error for missing credentials, got nil")
		}

		pNoSender := NewTwilioProvider("AC123", "token123", "", logger)
		if err := pNoSender.SendSMS(context.Background(), "+19998887777", "", "Test"); err == nil {
			t.Error("expected error for missing sender, got nil")
		}
	})

	t.Run("Successful send via mock HTTP server", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, pass, ok := r.BasicAuth()
			if !ok || user != "ACtest" || pass != "tokentest" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			if r.Method != http.MethodPost {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			_ = r.ParseForm()
			if r.FormValue("To") != "+19998887777" || r.FormValue("From") != "+13306326170" || r.FormValue("Body") != "Hello Twilio" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"sid": "SM123456", "status": "queued"}`))
		}))
		defer ts.Close()

		p := NewTwilioProvider("ACtest", "tokentest", "+13306326170", logger)
		p.BaseURL = ts.URL
		p.HTTPClient = ts.Client()

		err := p.SendSMS(context.Background(), "+19998887777", "", "Hello Twilio")
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
	})

	t.Run("Twilio API error response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"code": 21211, "message": "The 'To' number is not a valid phone number."}`))
		}))
		defer ts.Close()

		p := NewTwilioProvider("ACtest", "tokentest", "+13306326170", logger)
		p.BaseURL = ts.URL
		p.HTTPClient = ts.Client()

		err := p.SendSMS(context.Background(), "invalid-number", "", "Hello")
		if err == nil {
			t.Fatal("expected Twilio error, got nil")
		}
	})
}
