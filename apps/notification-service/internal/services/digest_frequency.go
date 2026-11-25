package services

import (
	"sync"
	"time"
)

// DigestMode controls whether notifications are sent immediately or batched.
type DigestMode string

const (
	DigestImmediate DigestMode = "IMMEDIATE"
	DigestHourly    DigestMode = "HOURLY_DIGEST"
	DigestDaily     DigestMode = "DAILY_DIGEST"
)

// FrequencyPolicy defines per-user notification throttling and digest preferences.
type FrequencyPolicy struct {
	UserID       string     `json:"userId"`
	MaxPerHour   int        `json:"maxPerHour"`
	MaxPerDay    int        `json:"maxPerDay"`
	DigestMode   DigestMode `json:"digestMode"`
	MutedChannel string     `json:"mutedChannel,omitempty"`
}

// RetryVisibilityRecord tracks delivery retry attempts and failure reasons.
type RetryVisibilityRecord struct {
	NotificationID string `json:"notificationId"`
	Channel        string `json:"channel"`
	AttemptCount   int    `json:"attemptCount"`
	MaxAttempts    int    `json:"maxAttempts"`
	NextRetryAt    string `json:"nextRetryAt,omitempty"`
	LastError      string `json:"lastError"`
	Status         string `json:"status"`
}

// FrequencyDigestManager manages user frequency caps, digest queues, and retry visibility.
type FrequencyDigestManager struct {
	mu           sync.RWMutex
	policies     map[string]FrequencyPolicy
	sentHistory  map[string][]time.Time
	digestQueues map[string][]string
	retries      map[string]RetryVisibilityRecord
}

func NewFrequencyDigestManager() *FrequencyDigestManager {
	return &FrequencyDigestManager{
		policies:     make(map[string]FrequencyPolicy),
		sentHistory:  make(map[string][]time.Time),
		digestQueues: make(map[string][]string),
		retries:      make(map[string]RetryVisibilityRecord),
	}
}

func (m *FrequencyDigestManager) SetPolicy(policy FrequencyPolicy) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if policy.MaxPerHour <= 0 {
		policy.MaxPerHour = 10
	}
	if policy.MaxPerDay <= 0 {
		policy.MaxPerDay = 50
	}
	if policy.DigestMode == "" {
		policy.DigestMode = DigestImmediate
	}
	m.policies[policy.UserID] = policy
}

// EvaluateDispatch checks frequency caps and digest preferences for a notification.
// Returns decision: "DISPATCH_NOW" | "QUEUED_FOR_DIGEST" | "THROTTLED" | "MUTED".
func (m *FrequencyDigestManager) EvaluateDispatch(userID, channel, notificationID string, now time.Time) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	policy, ok := m.policies[userID]
	if !ok {
		policy = FrequencyPolicy{
			UserID:     userID,
			MaxPerHour: 10,
			MaxPerDay:  50,
			DigestMode: DigestImmediate,
		}
	}

	if policy.MutedChannel != "" && policy.MutedChannel == channel {
		return "MUTED"
	}

	if policy.DigestMode != DigestImmediate {
		m.digestQueues[userID] = append(m.digestQueues[userID], notificationID)
		return "QUEUED_FOR_DIGEST"
	}

	// Prune timestamps older than 24h
	cutoffDay := now.Add(-24 * time.Hour)
	cutoffHour := now.Add(-1 * time.Hour)
	var recentDay []time.Time
	hourCount := 0
	for _, ts := range m.sentHistory[userID] {
		if ts.After(cutoffDay) {
			recentDay = append(recentDay, ts)
			if ts.After(cutoffHour) {
				hourCount++
			}
		}
	}

	if hourCount >= policy.MaxPerHour || len(recentDay) >= policy.MaxPerDay {
		m.sentHistory[userID] = recentDay
		return "THROTTLED"
	}

	recentDay = append(recentDay, now)
	m.sentHistory[userID] = recentDay
	return "DISPATCH_NOW"
}

func (m *FrequencyDigestManager) FlushDigest(userID string) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	items := m.digestQueues[userID]
	delete(m.digestQueues, userID)
	return items
}

func (m *FrequencyDigestManager) RecordRetry(rec RetryVisibilityRecord) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.retries[rec.NotificationID] = rec
}

func (m *FrequencyDigestManager) GetRetryStatus(notificationID string) (RetryVisibilityRecord, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rec, ok := m.retries[notificationID]
	return rec, ok
}
