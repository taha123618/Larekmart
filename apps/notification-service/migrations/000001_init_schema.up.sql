-- 000001_init_schema.up.sql
-- Schema migration for notification-service

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    priority VARCHAR(16) DEFAULT 'normal', -- low, normal, high, urgent
    status VARCHAR(32) DEFAULT 'pending',   -- pending, processing, sent, delivered, failed, cancelled
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read_at) WHERE read_at IS NULL;

-- 2. Notification Deliveries table (per-channel tracking)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    notification_id VARCHAR(64) NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL,           -- email, sms, push, inapp
    recipient VARCHAR(255) NOT NULL,       -- email addr, phone number, device token, or user_id
    status VARCHAR(32) DEFAULT 'pending',   -- pending, processing, sent, delivered, failed, dead_letter
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    last_error TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_notification_id ON notification_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON notification_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_deliveries_channel ON notification_deliveries (channel);

-- 3. Notification Preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    notification_type VARCHAR(64) NOT NULL, -- order_update, account_welcome, promotional, security_alert
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    inapp_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_notification_type UNIQUE (user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON notification_preferences (user_id);

-- 4. Notification Templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,              -- welcome_email, order_confirmed, payment_success
    channel VARCHAR(32) NOT NULL,           -- email, sms, push, inapp
    subject VARCHAR(255),
    body_template TEXT NOT NULL,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_template_name_channel_version UNIQUE (name, channel, version)
);

CREATE INDEX IF NOT EXISTS idx_templates_name_channel ON notification_templates (name, channel) WHERE is_active = TRUE;

-- 5. User Devices table (for push notification routing)
CREATE TABLE IF NOT EXISTS user_devices (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    device_token VARCHAR(255) NOT NULL,
    platform VARCHAR(32) NOT NULL,          -- ios, android, web
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_device_token UNIQUE (user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices (user_id) WHERE is_active = TRUE;

-- 6. Notification Events table (for domain event idempotency & audit)
CREATE TABLE IF NOT EXISTS notification_events (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(128) NOT NULL UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    source_service VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) DEFAULT 'processed', -- received, processed, failed, duplicate
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_event_id ON notification_events (event_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON notification_events (event_type);

-- Seed default notification templates
INSERT INTO notification_templates (id, name, channel, subject, body_template, version, is_active)
VALUES 
    ('tpl_welcome_email', 'user.created', 'email', 'Welcome to Larekmart, {{.Username}}!', 'Hello {{.Username}},\n\nWelcome to Larekmart! Your account has been successfully created.\n\nHappy shopping!\nThe Larekmart Team', 1, true),
    ('tpl_welcome_inapp', 'user.created', 'inapp', 'Welcome to Larekmart', 'Welcome {{.Username}}! Explore our latest collections and discounts.', 1, true),
    ('tpl_welcome_push', 'user.created', 'push', 'Welcome to Larekmart!', 'Your account has been created. Check out what is new today!', 1, true),
    
    ('tpl_order_email', 'order.created', 'email', 'Order Confirmation #{{.OrderID}} - Larekmart', 'Hello {{.CustomerName}},\n\nThank you for your order! Total amount: ${{printf "%.2f" .Amount}}.\nStatus: {{.Status}}.\n\nWe are preparing your items for shipment.', 1, true),
    ('tpl_order_inapp', 'order.created', 'inapp', 'Order Confirmed', 'Your order #{{.OrderID}} of ${{printf "%.2f" .Amount}} has been placed successfully.', 1, true),
    ('tpl_order_sms', 'order.created', 'sms', NULL, 'Larekmart: Order #{{.OrderID}} confirmed (${{printf "%.2f" .Amount}}). Track order in app.', 1, true),
    ('tpl_order_push', 'order.created', 'push', 'Order Confirmed!', 'Your order #{{.OrderID}} is confirmed and processing.', 1, true),
    
    ('tpl_payment_email', 'payment.successful', 'email', 'Payment Receipt - Larekmart', 'Hello,\n\nWe received your payment of ${{printf "%.2f" .Amount}}.\nTransaction ID: {{.TransactionID}}.', 1, true),
    ('tpl_payment_inapp', 'payment.successful', 'inapp', 'Payment Successful', 'Payment of ${{printf "%.2f" .Amount}} received for your purchase.', 1, true)
ON CONFLICT DO NOTHING;
