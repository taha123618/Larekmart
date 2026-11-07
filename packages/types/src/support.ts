import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const TicketStatusEnum = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_AGENT",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
]);
export type TicketStatus = z.infer<typeof TicketStatusEnum>;

export const TicketPriorityEnum = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
  "URGENT",
]);
export type TicketPriority = z.infer<typeof TicketPriorityEnum>;

export const TicketSourceEnum = z.enum([
  "CUSTOMER",
  "SELLER",
  "ADMIN",
  "SYSTEM",
]);
export type TicketSource = z.infer<typeof TicketSourceEnum>;

export const SenderRoleEnum = z.enum([
  "CUSTOMER",
  "SELLER",
  "AGENT",
  "ADMIN",
  "SYSTEM",
]);
export type SenderRole = z.infer<typeof SenderRoleEnum>;

export const SupportTeamEnum = z.enum([
  "TIER_1",
  "TIER_2",
  "BILLING",
  "SELLER_OPS",
  "ESCALATIONS",
  "LOGISTICS",
]);
export type SupportTeam = z.infer<typeof SupportTeamEnum>;

// ============================================================================
// DTOs & Models
// ============================================================================

export const MediaAttachmentSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative().optional(),
});
export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;

export const TicketCategorySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  defaultPriority: TicketPriorityEnum,
  slaPolicyId: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketCategory = z.infer<typeof TicketCategorySchema>;

export const TicketSlaPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  priority: TicketPriorityEnum,
  firstResponseTimeMinutes: z.number().int().positive(),
  resolutionTimeMinutes: z.number().int().positive(),
  escalationTier: z.number().int().default(1),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketSlaPolicy = z.infer<typeof TicketSlaPolicySchema>;

export const TicketMessageSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  senderId: z.string(),
  senderRole: SenderRoleEnum,
  senderName: z.string().nullable().optional(),
  isInternalNote: z.boolean().default(false),
  content: z.string(),
  mediaAttachments: z.array(MediaAttachmentSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TicketMessage = z.infer<typeof TicketMessageSchema>;

export const TicketAssignmentSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  assignedBy: z.string(),
  assignedTo: z.string(),
  assignedTeam: SupportTeamEnum.nullable().optional(),
  assignedAt: z.string(),
  status: z.string(),
  notes: z.string().nullable().optional(),
});
export type TicketAssignment = z.infer<typeof TicketAssignmentSchema>;

export const TicketHistorySchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  actorId: z.string(),
  actorRole: SenderRoleEnum,
  action: z.string(),
  fromState: z.record(z.string(), z.any()).nullable().optional(),
  toState: z.record(z.string(), z.any()).nullable().optional(),
  changeReason: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type TicketHistory = z.infer<typeof TicketHistorySchema>;

export const TicketSchema = z.object({
  id: z.string().uuid(),
  ticketNumber: z.string(),
  subject: z.string(),
  description: z.string(),
  status: TicketStatusEnum,
  priority: TicketPriorityEnum,
  categoryId: z.string().uuid(),
  category: TicketCategorySchema.optional(),
  slaPolicyId: z.string().uuid().nullable().optional(),
  slaPolicy: TicketSlaPolicySchema.nullable().optional(),
  source: TicketSourceEnum,
  customerId: z.string().nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  sellerId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  paymentId: z.string().nullable().optional(),
  returnId: z.string().nullable().optional(),
  assignedAgentId: z.string().nullable().optional(),
  assignedTeam: SupportTeamEnum.nullable().optional(),
  firstResponseDueAt: z.string().nullable().optional(),
  resolutionDueAt: z.string().nullable().optional(),
  firstResponseAt: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  isEscalated: z.boolean().default(false),
  escalatedAt: z.string().nullable().optional(),
  escalationReason: z.string().nullable().optional(),
  chatSessionId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  messages: z.array(TicketMessageSchema).optional(),
  assignments: z.array(TicketAssignmentSchema).optional(),
  history: z.array(TicketHistorySchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Ticket = z.infer<typeof TicketSchema>;

// ============================================================================
// API Request & Query Schemas
// ============================================================================

export const CreateTicketSchema = z.preprocess(
  (data: any) => {
    if (data && typeof data === "object") {
      const categoryCode = data.categoryCode ?? data.category;
      return { ...data, categoryCode };
    }
    return data;
  },
  z.object({
    subject: z.string().min(3).max(255),
    description: z.string().min(10),
    categoryCode: z.string().min(2).max(64),
    priority: TicketPriorityEnum.optional().default("MEDIUM"),
    source: TicketSourceEnum.optional().default("CUSTOMER"),
    customerId: z.string().optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().optional(),
    sellerId: z.string().optional(),
    orderId: z.string().optional(),
    paymentId: z.string().optional(),
    returnId: z.string().optional(),
    chatSessionId: z.string().optional(),
    attachments: z.array(MediaAttachmentSchema).optional().default([]),
    metadata: z.record(z.string(), z.any()).optional().default({}),
  }),
);
export type CreateTicketInput = z.input<typeof CreateTicketSchema>;

export const UpdateTicketSchema = z.object({
  status: TicketStatusEnum.optional(),
  priority: TicketPriorityEnum.optional(),
  categoryCode: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

export const AddTicketMessageSchema = z.object({
  content: z.string().min(1),
  isInternalNote: z.boolean().optional().default(false),
  attachments: z.array(MediaAttachmentSchema).optional().default([]),
});
export type AddTicketMessageInput = z.input<typeof AddTicketMessageSchema>;

export const AssignTicketSchema = z.object({
  assignedTo: z.string().min(1),
  assignedTeam: SupportTeamEnum.optional().default("TIER_1"),
  notes: z.string().optional(),
});
export type AssignTicketInput = z.input<typeof AssignTicketSchema>;

export const EscalateTicketSchema = z.object({
  escalationReason: z.string().min(5),
  targetTeam: SupportTeamEnum.optional().default("ESCALATIONS"),
  priority: TicketPriorityEnum.optional(),
});
export type EscalateTicketInput = z.input<typeof EscalateTicketSchema>;

export const TicketFilterSchema = z.object({
  status: TicketStatusEnum.optional(),
  priority: TicketPriorityEnum.optional(),
  categoryCode: z.string().optional(),
  customerId: z.string().optional(),
  sellerId: z.string().optional(),
  orderId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  isEscalated: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type TicketFilterInput = z.infer<typeof TicketFilterSchema>;

// ============================================================================
// Kafka Topics & Events
// ============================================================================

export const SUPPORT_TOPICS = {
  TICKET_CREATED: "support.ticket.created",
  TICKET_ASSIGNED: "support.ticket.assigned",
  TICKET_UPDATED: "support.ticket.updated",
  TICKET_RESOLVED: "support.ticket.resolved",
} as const;

export interface SupportTicketCreatedEvent {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  categoryCode: string;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  customerId?: string | null;
  customerEmail?: string | null;
  sellerId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  returnId?: string | null;
  timestamp: string;
}

export interface SupportTicketAssignedEvent {
  ticketId: string;
  ticketNumber: string;
  assignedBy: string;
  assignedTo: string;
  assignedTeam: SupportTeam;
  timestamp: string;
}

export interface SupportTicketUpdatedEvent {
  ticketId: string;
  ticketNumber: string;
  previousStatus?: TicketStatus;
  newStatus?: TicketStatus;
  previousPriority?: TicketPriority;
  newPriority?: TicketPriority;
  updatedBy: string;
  timestamp: string;
}

export interface SupportTicketResolvedEvent {
  ticketId: string;
  ticketNumber: string;
  resolvedBy: string;
  resolutionTimeMinutes: number;
  slaBreached: boolean;
  timestamp: string;
}
