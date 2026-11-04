import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class FraudRule(Base):
    __tablename__ = "fraud_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    workflow = Column(String(32), nullable=False, index=True)
    score_delta = Column(Integer, nullable=False)
    action = Column(String(16), nullable=False, default="FLAG")  # FLAG, REVIEW, BLOCK
    conditions = Column(JSONB, nullable=False, default=dict)
    fail_mode = Column(String(16), nullable=False, default="FAIL_CLOSED")  # FAIL_OPEN, FAIL_CLOSED
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow = Column(String(32), nullable=False, index=True)
    entity_id = Column(String(128), nullable=False, index=True)
    entity_type = Column(String(64), nullable=False)
    user_id = Column(String(128), nullable=True, index=True)
    seller_id = Column(String(128), nullable=True, index=True)
    risk_score = Column(Integer, nullable=False, index=True)
    decision = Column(String(16), nullable=False, index=True)  # ALLOW, REVIEW, BLOCK
    reason_summary = Column(Text, nullable=False)
    fail_mode_used = Column(Boolean, default=False, nullable=False)
    assessment_metadata = Column(JSONB, nullable=False, default=dict)
    latency_ms = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    signals = relationship("RiskSignal", back_populates="assessment", cascade="all, delete-orphan")
    case = relationship("FraudCase", back_populates="assessment", uselist=False)


class RiskSignal(Base):
    __tablename__ = "risk_signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("risk_assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    signal_name = Column(String(128), nullable=False, index=True)
    signal_value = Column(String(256), nullable=False)
    score_delta = Column(Integer, nullable=False)
    signal_metadata = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    assessment = relationship("RiskAssessment", back_populates="signals")


class FraudCase(Base):
    __tablename__ = "fraud_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("risk_assessments.id", ondelete="RESTRICT"), nullable=False, index=True)
    workflow = Column(String(32), nullable=False, index=True)
    entity_id = Column(String(128), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="OPEN", index=True)  # OPEN, IN_REVIEW, RESOLVED_BLOCKED, RESOLVED_DISMISSED
    priority = Column(String(16), nullable=False, default="MEDIUM", index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    assigned_to = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    assessment = relationship("RiskAssessment", back_populates="case")
    decisions = relationship("FraudDecision", back_populates="case", cascade="all, delete-orphan")


class FraudDecision(Base):
    __tablename__ = "fraud_decisions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("fraud_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    analyst_id = Column(String(128), nullable=False)
    decision = Column(String(32), nullable=False)  # APPROVE, BLOCK, DISMISS
    notes = Column(Text, nullable=False)
    override_previous = Column(Boolean, default=False, nullable=False)
    audit_trail = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    case = relationship("FraudCase", back_populates="decisions")


class RiskModelVersion(Base):
    __tablename__ = "risk_model_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(128), nullable=False, index=True)
    algorithm = Column(String(64), nullable=False)
    hyperparameters = Column(JSONB, nullable=False, default=dict)
    metrics = Column(JSONB, nullable=False, default=dict)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    trained_at = Column(DateTime, default=datetime.utcnow, nullable=False)

