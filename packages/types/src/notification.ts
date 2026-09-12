import { z } from "zod";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled";

export type NotificationChannel = "email" | "sms" | "push" | "inapp";

export type DeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "delivered"
  | "failed"
  | "dead_letter";

export interface NotificationDeliveryType {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  recipient: string;
  status: DeliveryStatus;
  attempts: number;
  max_attempts: number;
  last_error?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationType {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  priority: NotificationPriority;
  status: NotificationStatus;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
  deliveries?: NotificationDeliveryType[];
}

export interface NotificationPreferenceType {
  id: string;
  user_id: string;
  notification_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  inapp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateType {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;
  body_template: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserDeviceType {
  id: string;
  user_id: string;
  device_token: string;
  platform: "ios" | "android" | "web";
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

// Zod validation schemas for client/admin and API mutations
export const UpdatePreferenceSchema = z.object({
  notification_type: z.string().min(1, "notification_type is required"),
  email_enabled: z.boolean().default(true),
  sms_enabled: z.boolean().default(false),
  push_enabled: z.boolean().default(true),
  inapp_enabled: z.boolean().default(true),
});

export type UpdatePreferenceInput = z.infer<typeof UpdatePreferenceSchema>;

export const RegisterDeviceSchema = z.object({
  device_token: z.string().min(1, "device_token is required"),
  platform: z.enum(["ios", "android", "web"]).default("web"),
});

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;

export const DispatchNotificationSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  type: z.string().min(1, "type is required"),
  title: z.string().min(1, "title is required"),
  body: z.string().min(1, "body is required"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),

  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export type DispatchNotificationInput = z.infer<
  typeof DispatchNotificationSchema
>;
