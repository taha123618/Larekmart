from datetime import datetime
from typing import Any, Literal
from uuid import UUID, uuid4
from pydantic import BaseModel, Field

AssessmentWorkflow = Literal[
    "PAYMENT",
    "ORDER",
    "ACCOUNT",
    "PROMOTION",
    "PAYOUT",
    "SELLER",
]

RiskDecision = Literal["ALLOW", "REVIEW", "BLOCK"]
RiskAction = Literal["FLAG", "REVIEW", "BLOCK"]
FailMode = Literal["FAIL_OPEN", "FAIL_CLOSED"]
FraudCaseStatus = Literal["OPEN", "IN_REVIEW", "RESOLVED_BLOCKED", "RESOLVED_DISMISSED"]
FraudCasePriority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
AnalystDecision = Literal["APPROVE", "BLOCK", "DISMISS"]


class AssessRiskRequest(BaseModel):
    workflow: AssessmentWorkflow
    entityId: str = Field(..., min_length=1)
    entityType: str = Field(..., min_length=1)
    userId: str | None = None
    sellerId: str | None = None
    amount: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=3)
    ipAddress: str | None = None
    deviceFingerprint: str | None = None
    paymentMethod: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SignalDetail(BaseModel):
    name: str
    scoreDelta: int
    reason: str


class AssessRiskResponse(BaseModel):
    assessmentId: str
    workflow: AssessmentWorkflow
    entityId: str
    riskScore: int = Field(..., ge=0, le=100)
    decision: RiskDecision
    triggeredRules: list[str] = Field(default_factory=list)
    signals: list[SignalDetail] = Field(default_factory=list)
    caseId: str | None = None
    failModeUsed: bool = False
    latencyMs: int = Field(default=0, ge=0)
    createdAt: str


class CreateFraudRuleRequest(BaseModel):
    ruleCode: str = Field(..., min_length=3, max_length=64)
    name: str = Field(..., min_length=3, max_length=128)
    description: str | None = None
    workflow: AssessmentWorkflow
    scoreDelta: int = Field(..., ge=1, le=100)
    action: RiskAction = "FLAG"
    conditions: dict[str, Any] = Field(default_factory=dict)
    failMode: FailMode = "FAIL_CLOSED"
    isActive: bool = True


class ReviewFraudCaseRequest(BaseModel):
    decision: AnalystDecision
    notes: str = Field(..., min_length=1)
    analystId: str = Field(..., min_length=1)
    overridePrevious: bool = False


class FraudRuleDTO(BaseModel):
    id: str
    ruleCode: str
    name: str
    description: str | None = None
    workflow: AssessmentWorkflow
    scoreDelta: int
    action: RiskAction
    conditions: dict[str, Any]
    failMode: FailMode
    isActive: bool
    createdAt: str


class FraudCaseDTO(BaseModel):
    id: str
    assessmentId: str
    workflow: AssessmentWorkflow
    entityId: str
    status: FraudCaseStatus
    priority: FraudCasePriority
    assignedTo: str | None = None
    createdAt: str
    updatedAt: str


class FraudDecisionDTO(BaseModel):
    id: str
    caseId: str
    analystId: str
    decision: AnalystDecision
    notes: str
    overridePrevious: bool
    auditTrail: dict[str, Any] = Field(default_factory=dict)
    createdAt: str


class RiskModelVersionDTO(BaseModel):
    id: str
    modelName: str
    algorithm: str
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)
    isActive: bool = True
    trainedAt: str


class RetrainModelRequest(BaseModel):
    modelName: str = Field(default="isolation_forest_v1", min_length=3, max_length=128)
    nEstimators: int = Field(default=50, ge=10, le=500)
    contamination: float = Field(default=0.05, ge=0.01, le=0.5)


class RulePerformanceStat(BaseModel):
    ruleCode: str
    totalTriggers: int = 0
    confirmedFraud: int = 0
    falsePositives: int = 0
    accuracyRate: float = 0.0


class FraudPerformanceMetricsDTO(BaseModel):
    totalAssessments: int = 0
    totalCases: int = 0
    totalResolvedCases: int = 0
    confirmedFraudCases: int = 0
    falsePositiveCases: int = 0
    falsePositiveRate: float = 0.0
    trueBlockRate: float = 0.0
    averageLatencyMs: float = 0.0
    rulePerformance: list[RulePerformanceStat] = Field(default_factory=list)


