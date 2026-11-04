import { z } from "zod";

// ============================================================================
// Fraud Enums
// ============================================================================

export const AssessmentWorkflowEnum = z.enum([
  "PAYMENT",
  "ORDER",
  "ACCOUNT",
  "PROMOTION",
  "PAYOUT",
  "SELLER",
]);
export type AssessmentWorkflow = z.infer<typeof AssessmentWorkflowEnum>;

export const RiskDecisionEnum = z.enum(["ALLOW", "REVIEW", "BLOCK"]);
export type RiskDecision = z.infer<typeof RiskDecisionEnum>;

export const RiskActionEnum = z.enum(["FLAG", "REVIEW", "BLOCK"]);
export type RiskAction = z.infer<typeof RiskActionEnum>;

export const FailModeEnum = z.enum(["FAIL_OPEN", "FAIL_CLOSED"]);
export type FailMode = z.infer<typeof FailModeEnum>;

export const FraudCaseStatusEnum = z.enum([
  "OPEN",
  "IN_REVIEW",
  "RESOLVED_BLOCKED",
  "RESOLVED_DISMISSED",
]);
export type FraudCaseStatus = z.infer<typeof FraudCaseStatusEnum>;

export const FraudCasePriorityEnum = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);
export type FraudCasePriority = z.infer<typeof FraudCasePriorityEnum>;

export const AnalystDecisionEnum = z.enum(["APPROVE", "BLOCK", "DISMISS"]);
export type AnalystDecision = z.infer<typeof AnalystDecisionEnum>;

// ============================================================================
// Entities & Models
// ============================================================================

export const FraudRuleSchema = z.object({
  id: z.string().uuid(),
  ruleCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  workflow: AssessmentWorkflowEnum,
  scoreDelta: z.number().int().min(0).max(100),
  action: RiskActionEnum,
  conditions: z.record(z.string(), z.any()),
  failMode: FailModeEnum.default("FAIL_CLOSED"),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
export type FraudRule = z.infer<typeof FraudRuleSchema>;

export const RiskSignalSchema = z.object({
  id: z.string().uuid().optional(),
  assessmentId: z.string().uuid(),
  signalName: z.string(),
  signalValue: z.string(),
  scoreDelta: z.number().int(),
  signalMetadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string().optional(),
});
export type RiskSignal = z.infer<typeof RiskSignalSchema>;

export const RiskAssessmentSchema = z.object({
  id: z.string().uuid(),
  workflow: AssessmentWorkflowEnum,
  entityId: z.string(),
  entityType: z.string(),
  userId: z.string().nullable().optional(),
  sellerId: z.string().nullable().optional(),
  riskScore: z.number().int().min(0).max(100),
  decision: RiskDecisionEnum,
  reasonSummary: z.string(),
  failModeUsed: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional(),
  latencyMs: z.number().int().min(0),
  createdAt: z.string(),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

export const FraudCaseSchema = z.object({
  id: z.string().uuid(),
  assessmentId: z.string().uuid(),
  workflow: AssessmentWorkflowEnum,
  entityId: z.string(),
  status: FraudCaseStatusEnum,
  priority: FraudCasePriorityEnum,
  assignedTo: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FraudCase = z.infer<typeof FraudCaseSchema>;

export const FraudDecisionSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  analystId: z.string(),
  decision: AnalystDecisionEnum,
  notes: z.string(),
  overridePrevious: z.boolean().default(false),
  auditTrail: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
});
export type FraudDecision = z.infer<typeof FraudDecisionSchema>;

export const RiskModelVersionSchema = z.object({
  id: z.string().uuid(),
  modelName: z.string(),
  algorithm: z.string(),
  hyperparameters: z.record(z.string(), z.any()).optional(),
  metrics: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true),
  trainedAt: z.string(),
});
export type RiskModelVersion = z.infer<typeof RiskModelVersionSchema>;

// ============================================================================
// API Request & Response Contracts
// ============================================================================

export const AssessRiskRequestSchema = z.object({
  workflow: AssessmentWorkflowEnum,
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  userId: z.string().optional(),
  sellerId: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  ipAddress: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  paymentMethod: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});
export type AssessRiskRequest = z.infer<typeof AssessRiskRequestSchema>;

export const AssessRiskResponseSchema = z.object({
  assessmentId: z.string().uuid(),
  workflow: AssessmentWorkflowEnum,
  entityId: z.string(),
  riskScore: z.number().int().min(0).max(100),
  decision: RiskDecisionEnum,
  triggeredRules: z.array(z.string()),
  signals: z.array(
    z.object({
      name: z.string(),
      scoreDelta: z.number().int(),
      reason: z.string(),
    }),
  ),
  caseId: z.string().uuid().nullable().optional(),
  failModeUsed: z.boolean(),
  latencyMs: z.number().int(),
  createdAt: z.string(),
});
export type AssessRiskResponse = z.infer<typeof AssessRiskResponseSchema>;

export const ReviewFraudCaseSchema = z.object({
  decision: AnalystDecisionEnum,
  notes: z.string().min(1),
  analystId: z.string().min(1),
  overridePrevious: z.boolean().optional().default(false),
});
export type ReviewFraudCase = z.infer<typeof ReviewFraudCaseSchema>;

export const CreateFraudRuleSchema = z.object({
  ruleCode: z.string().min(3).max(64),
  name: z.string().min(3).max(128),
  description: z.string().optional(),
  workflow: AssessmentWorkflowEnum,
  scoreDelta: z.number().int().min(1).max(100),
  action: RiskActionEnum,
  conditions: z.record(z.string(), z.any()),
  failMode: FailModeEnum.default("FAIL_CLOSED"),
  isActive: z.boolean().default(true),
});
export type CreateFraudRule = z.infer<typeof CreateFraudRuleSchema>;

// ============================================================================
// Kafka Topics & Events
// ============================================================================

export const FRAUD_TOPICS = {
  ASSESSMENT_COMPLETED: "fraud.assessment.completed",
  RISK_DETECTED: "fraud.risk.detected",
  CASE_CREATED: "fraud.case.created",
  CASE_RESOLVED: "fraud.case.resolved",
} as const;

export interface FraudAssessmentCompletedEvent {
  assessmentId: string;
  workflow: AssessmentWorkflow;
  entityId: string;
  userId?: string;
  sellerId?: string;
  riskScore: number;
  decision: RiskDecision;
  triggeredRules: string[];
  failModeUsed: boolean;
  timestamp: string;
}

export interface FraudRiskDetectedEvent {
  assessmentId: string;
  workflow: AssessmentWorkflow;
  entityId: string;
  userId?: string;
  sellerId?: string;
  riskScore: number;
  decision: RiskDecision;
  triggeredRules: string[];
  timestamp: string;
}

export interface FraudCaseCreatedEvent {
  caseId: string;
  assessmentId: string;
  workflow: AssessmentWorkflow;
  entityId: string;
  priority: FraudCasePriority;
  riskScore: number;
  timestamp: string;
}

export interface FraudCaseResolvedEvent {
  caseId: string;
  analystId: string;
  decision: AnalystDecision;
  notes: string;
  timestamp: string;
}
