package models

import (
	"testing"
	"time"
)

func TestModelConstants(t *testing.T) {
	if ChannelEmail != "email" || ChannelSMS != "sms" || ChannelPush != "push" || ChannelInApp != "inapp" {
		t.Error("channel constants do not match expected values")
	}

	if PriorityLow != "low" || PriorityNormal != "normal" || PriorityHigh != "high" || PriorityUrgent != "urgent" {
		t.Error("priority constants do not match expected values")
	}

	if StatusPending != "pending" || StatusDelivered != "delivered" || StatusFailed != "failed" {
		t.Error("status constants do not match expected values")
	}
}

func TestNotificationStructure(t *testing.T) {
	now := time.Now().UTC()
	n := Notification{
		ID:        "test-id",
		UserID:    "user-1",
		Type:      "order.created",
		Title:     "Order Placed",
		Body:      "Your order was placed successfully.",
		Priority:  PriorityHigh,
		Status:    StatusSent,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if n.ID != "test-id" || n.Priority != PriorityHigh {
		t.Errorf("unexpected notification field values: %+v", n)
	}
}
