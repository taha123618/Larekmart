package consumers

import (
	"encoding/json"
	"testing"

	"github.com/taha123618/Larekmart/apps/notification-service/internal/models"
)

func TestExtractOrComputeEventID(t *testing.T) {
	// 1. Explicit eventId field
	payload1 := map[string]interface{}{"eventId": "evt_custom_123"}
	id1 := extractOrComputeEventID("order.created", nil, nil, payload1)
	if id1 != "evt_custom_123" {
		t.Errorf("expected evt_custom_123, got %s", id1)
	}

	// 2. Fallback to id field
	payload2 := map[string]interface{}{"id": "order_999"}
	id2 := extractOrComputeEventID("order.created", nil, nil, payload2)
	if id2 != "order.created:order_999" {
		t.Errorf("expected order.created:order_999, got %s", id2)
	}

	// 3. Deterministic sha256 hash fallback
	payload3 := map[string]interface{}{"amount": 5900}
	rawJSON, _ := json.Marshal(payload3)
	id3a := extractOrComputeEventID("order.created", []byte("key1"), rawJSON, payload3)
	id3b := extractOrComputeEventID("order.created", []byte("key1"), rawJSON, payload3)

	if id3a == "" {
		t.Error("expected non-empty deterministic hash")
	}
	if id3a != id3b {
		t.Errorf("expected identical hashes for same input, got %s vs %s", id3a, id3b)
	}
}

func TestExtractSourceService(t *testing.T) {
	tests := []struct {
		topic string
		want  string
	}{
		{"user.created", "auth-service"},
		{"order.created", "order-service"},
		{"payment.successful", "payment-service"},
		{"product.created", "product-service"},
		{"custom.event", "unknown"},
	}

	for _, tt := range tests {
		if got := extractSourceService(tt.topic); got != tt.want {
			t.Errorf("extractSourceService(%q) = %q, want %q", tt.topic, got, tt.want)
		}
	}
}

func TestKafkaEnvelope_Unmarshal(t *testing.T) {
	envelopeJSON := `{"value":{"username":"johndoe","email":"john@example.com"}}`

	var envelope models.KafkaEnvelope
	err := json.Unmarshal([]byte(envelopeJSON), &envelope)
	if err != nil {
		t.Fatalf("failed to unmarshal Kafka envelope: %v", err)
	}

	if envelope.Value["username"] != "johndoe" {
		t.Errorf("expected username=johndoe, got %v", envelope.Value["username"])
	}
	if envelope.Value["email"] != "john@example.com" {
		t.Errorf("expected email=john@example.com, got %v", envelope.Value["email"])
	}
}
