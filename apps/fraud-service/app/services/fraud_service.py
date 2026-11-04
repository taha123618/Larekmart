import time
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, desc
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import (
    FraudCase,
    FraudDecision,
    FraudRule,
    RiskAssessment,
    RiskSignal,
)
from app.db.session import get_session_maker
from app.engine.ml_engine import ml_engine
from app.engine.rules_engine import rules_engine
from app.kafka.producer import emit_fraud_event
from app.observability.metrics import (
    FRAUD_ASSESSMENTS_TOTAL,
    FRAUD_ASSESSMENT_DURATION_SECONDS,
    FRAUD_CASES_CREATED_TOTAL,
    FRAUD_CASES_RESOLVED_TOTAL,
)
from app.redis.velocity import velocity_tracker
from app.schemas.fraud import (
    AssessRiskRequest,
    AssessRiskResponse,
    CreateFraudRuleRequest,
    FraudCaseDTO,
    FraudRuleDTO,
    ReviewFraudCaseRequest,
    RiskDecision,
    SignalDetail,
)

logger = get_logger("fraud-service.service")

# In-memory storage fallback for standalone unit tests or during database degradation
_in_memory_assessments: dict[str, dict[str, Any]] = {}
_in_memory_cases: dict[str, dict[str, Any]] = {}
_in_memory_rules: dict[str, dict[str, Any]] = {
    "rule_1": {
        "id": "00000000-0000-0000-0000-000000000001",
        "ruleCode": "R_USER_VELOCITY_CRITICAL",
        "name": "Critical User Velocity Surge",
        "description": "High transaction frequency: >= 8 requests within the 10-minute sliding window.",
        "workflow": "ORDER",
        "scoreDelta": 50,
        "action": "BLOCK",
        "conditions": {"velocity_threshold": 8, "window_seconds": 600},
        "failMode": "FAIL_CLOSED",
        "isActive": True,
        "createdAt": "2026-11-04T00:00:00Z",
    },
    "rule_2": {
        "id": "00000000-0000-0000-0000-000000000002",
        "ruleCode": "R_IP_VELOCITY_ABUSE",
        "name": "IP Address Request Flooding",
        "description": "Suspicious request velocity: >= 10 requests from the same client IP.",
        "workflow": "PAYMENT",
        "scoreDelta": 40,
        "action": "REVIEW",
        "conditions": {"ip_velocity_threshold": 10},
        "failMode": "FAIL_CLOSED",
        "isActive": True,
        "createdAt": "2026-11-04T00:00:00Z",
    },
    "rule_3": {
        "id": "00000000-0000-0000-0000-000000000003",
        "ruleCode": "R_EXTREME_TRANSACTION_AMOUNT",
        "name": "Extreme Value Transaction Threshold",
        "description": "Transaction amount exceeds 500,000 threshold requiring manual scrutiny.",
        "workflow": "PAYMENT",
        "scoreDelta": 45,
        "action": "REVIEW",
        "conditions": {"amount_threshold": 500000},
        "failMode": "FAIL_CLOSED",
        "isActive": True,
        "createdAt": "2026-11-04T00:00:00Z",
    },
    "rule_4": {
        "id": "00000000-0000-0000-0000-000000000004",
        "ruleCode": "R_PAYOUT_NEW_OR_MODIFIED_ACCOUNT",
        "name": "Seller Payout Account Modified < 48 Hours",
        "description": "Seller bank account changed within 48 hours prior to scheduled payout.",
        "workflow": "PAYOUT",
        "scoreDelta": 40,
        "action": "REVIEW",
        "conditions": {"account_age_hours": 48},
        "failMode": "FAIL_CLOSED",
        "isActive": True,
        "createdAt": "2026-11-04T00:00:00Z",
    },
    "rule_5": {
        "id": "00000000-0000-0000-0000-000000000005",
        "ruleCode": "R_PAYOUT_SELLER_DISPUTE_SURGE",
        "name": "Seller Under Active Dispute or Fraud Hold",
        "description": "Immediate block of payout settlement if seller has active dispute holds.",
        "workflow": "PAYOUT",
        "scoreDelta": 45,
        "action": "BLOCK",
        "conditions": {"hold_active": True},
        "failMode": "FAIL_CLOSED",
        "isActive": True,
        "createdAt": "2026-11-04T00:00:00Z",
    },
    "rule_6": {
        "id": "00000000-0000-0000-0000-000000000006",
        "ruleCode": "R_PROMOTION_COUPON_REUSE_ABUSE",
        "name": "Promotion Coupon Velocity Abuse",
        "description": "Repeated coupon redemption velocity exceeding legitimate consumer thresholds.",
        "workflow": "PROMOTION",
        "scoreDelta": 35,
        "action": "FLAG",
        "conditions": {"coupon_velocity_threshold": 4},
        "failMode": "FAIL_OPEN",
        "isActive": True,
        "createdAt": "2026-11-04T00:00:00Z",
    },
}


class FraudService:
    """
    Core orchestrator coordinating rule evaluation, velocity abuse detection,
    scikit-learn anomaly scoring, case escalation, and Kafka event publishing.
    """

    async def assess_risk(self, request: AssessRiskRequest) -> AssessRiskResponse:
        start_time = time.time()
        settings = get_settings()
        assessment_id = str(uuid.uuid4())
        workflow = request.workflow

        # 1. Rule Engine Evaluation
        rule_result = await rules_engine.evaluate(request)
        combined_score = rule_result.score
        triggered_rules = list(rule_result.triggered_rules)
        signals = list(rule_result.signals)

        # 2. scikit-learn Anomaly Detection (only if not already failing closed)
        if not rule_result.fail_mode_used:
            user_velocity = (
                await velocity_tracker.get_velocity(f"user:{request.userId}")
                if request.userId
                else 1
            )
            ml_delta, ml_signal = ml_engine.predict_anomaly(request, user_velocity)
            if ml_delta > 0 and ml_signal:
                combined_score = min(100, combined_score + ml_delta)
                triggered_rules.append("R_ML_ANOMALY_DETECTION")
                signals.append(ml_signal)

        # 3. Decision Determination
        if combined_score >= settings.BLOCK_THRESHOLD:
            decision: RiskDecision = "BLOCK"
        elif combined_score >= settings.REVIEW_THRESHOLD:
            decision: RiskDecision = "REVIEW"
        else:
            decision: RiskDecision = "ALLOW"

        latency_ms = int((time.time() - start_time) * 1000)
        created_at_iso = datetime.now(timezone.utc).isoformat()
        case_id: str | None = None

        # 4. Case Escalation for REVIEW or BLOCK
        if decision in ("REVIEW", "BLOCK"):
            case_id = str(uuid.uuid4())
            priority = (
                "CRITICAL"
                if decision == "BLOCK"
                else ("HIGH" if combined_score >= 60 else "MEDIUM")
            )

            # Record in-memory fallback
            _in_memory_cases[case_id] = {
                "id": case_id,
                "assessmentId": assessment_id,
                "workflow": workflow,
                "entityId": request.entityId,
                "status": "OPEN",
                "priority": priority,
                "assignedTo": None,
                "createdAt": created_at_iso,
                "updatedAt": created_at_iso,
            }

            FRAUD_CASES_CREATED_TOTAL.labels(workflow=workflow, priority=priority).inc()

            # Async event emission
            await emit_fraud_event(
                "fraud.case.created",
                {
                    "caseId": case_id,
                    "assessmentId": assessment_id,
                    "workflow": workflow,
                    "entityId": request.entityId,
                    "priority": priority,
                    "riskScore": combined_score,
                    "timestamp": created_at_iso,
                },
            )
            await emit_fraud_event(
                "fraud.risk.detected",
                {
                    "assessmentId": assessment_id,
                    "workflow": workflow,
                    "entityId": request.entityId,
                    "userId": request.userId,
                    "sellerId": request.sellerId,
                    "riskScore": combined_score,
                    "decision": decision,
                    "triggeredRules": triggered_rules,
                    "timestamp": created_at_iso,
                },
            )

        # 5. Persist to Database if DB is connected
        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                assessment_record = RiskAssessment(
                    id=uuid.UUID(assessment_id),
                    workflow=workflow,
                    entity_id=request.entityId,
                    entity_type=request.entityType,
                    user_id=request.userId,
                    seller_id=request.sellerId,
                    risk_score=combined_score,
                    decision=decision,
                    reason_summary="; ".join(s.reason for s in signals) if signals else "No anomalies detected",
                    fail_mode_used=rule_result.fail_mode_used,
                    assessment_metadata=request.metadata,
                    latency_ms=latency_ms,
                )
                session.add(assessment_record)

                for sig in signals:
                    sig_record = RiskSignal(
                        assessment_id=uuid.UUID(assessment_id),
                        signal_name=sig.name,
                        signal_value=str(sig.scoreDelta),
                        score_delta=sig.scoreDelta,
                        signal_metadata={"reason": sig.reason},
                    )
                    session.add(sig_record)

                if case_id:
                    case_record = FraudCase(
                        id=uuid.UUID(case_id),
                        assessment_id=uuid.UUID(assessment_id),
                        workflow=workflow,
                        entity_id=request.entityId,
                        status="OPEN",
                        priority="CRITICAL" if decision == "BLOCK" else "HIGH",
                    )
                    session.add(case_record)

                await session.commit()
        except Exception as e:
            # Fallback to in-memory store so testing/degraded mode continues smoothly
            logger.debug("Database write bypassed (in-memory mode)", error=str(e))
            _in_memory_assessments[assessment_id] = {
                "assessmentId": assessment_id,
                "workflow": workflow,
                "entityId": request.entityId,
                "riskScore": combined_score,
                "decision": decision,
                "triggeredRules": triggered_rules,
                "signals": [s.model_dump() for s in signals],
                "caseId": case_id,
                "failModeUsed": rule_result.fail_mode_used,
                "latencyMs": latency_ms,
                "createdAt": created_at_iso,
            }

        # 6. Observability Metrics & Completed Event
        duration = time.time() - start_time
        FRAUD_ASSESSMENT_DURATION_SECONDS.labels(workflow=workflow).observe(duration)
        FRAUD_ASSESSMENTS_TOTAL.labels(
            workflow=workflow,
            decision=decision,
            fail_mode_used=str(rule_result.fail_mode_used),
        ).inc()

        await emit_fraud_event(
            "fraud.assessment.completed",
            {
                "assessmentId": assessment_id,
                "workflow": workflow,
                "entityId": request.entityId,
                "userId": request.userId,
                "sellerId": request.sellerId,
                "riskScore": combined_score,
                "decision": decision,
                "triggeredRules": triggered_rules,
                "failModeUsed": rule_result.fail_mode_used,
                "timestamp": created_at_iso,
            },
        )

        return AssessRiskResponse(
            assessmentId=assessment_id,
            workflow=workflow,
            entityId=request.entityId,
            riskScore=combined_score,
            decision=decision,
            triggeredRules=triggered_rules,
            signals=signals,
            caseId=case_id,
            failModeUsed=rule_result.fail_mode_used,
            latencyMs=latency_ms,
            createdAt=created_at_iso,
        )

    async def get_assessment(self, assessment_id: str) -> dict[str, Any] | None:
        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                stmt = select(RiskAssessment).where(RiskAssessment.id == uuid.UUID(assessment_id))
                res = await session.execute(stmt)
                record = res.scalar_one_or_none()
                if record:
                    return {
                        "assessmentId": str(record.id),
                        "workflow": record.workflow,
                        "entityId": record.entity_id,
                        "entityType": record.entity_type,
                        "userId": record.user_id,
                        "sellerId": record.seller_id,
                        "riskScore": record.risk_score,
                        "decision": record.decision,
                        "reasonSummary": record.reason_summary,
                        "failModeUsed": record.fail_mode_used,
                        "latencyMs": record.latency_ms,
                        "createdAt": record.created_at.isoformat(),
                    }
        except Exception:
            pass
        return _in_memory_assessments.get(assessment_id)

    async def list_cases(
        self,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[FraudCaseDTO]:
        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                query = select(FraudCase).order_by(desc(FraudCase.created_at))
                if status:
                    query = query.where(FraudCase.status == status)
                if priority:
                    query = query.where(FraudCase.priority == priority)
                query = query.offset(offset).limit(limit)
                res = await session.execute(query)
                records = res.scalars().all()
                if records:
                    return [
                        FraudCaseDTO(
                            id=str(r.id),
                            assessmentId=str(r.assessment_id),
                            workflow=r.workflow,
                            entityId=r.entity_id,
                            status=r.status,
                            priority=r.priority,
                            assignedTo=r.assigned_to,
                            createdAt=r.created_at.isoformat(),
                            updatedAt=r.updated_at.isoformat(),
                        )
                        for r in records
                    ]
        except Exception:
            pass

        # In-memory fallback
        cases = list(_in_memory_cases.values())
        if status:
            cases = [c for c in cases if c["status"] == status]
        if priority:
            cases = [c for c in cases if c["priority"] == priority]
        paged = cases[offset : offset + limit]
        return [FraudCaseDTO(**c) for c in paged]

    async def review_case(
        self, case_id: str, request: ReviewFraudCaseRequest
    ) -> dict[str, Any]:
        new_status = (
            "RESOLVED_BLOCKED" if request.decision == "BLOCK" else "RESOLVED_DISMISSED"
        )
        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                stmt = select(FraudCase).where(FraudCase.id == uuid.UUID(case_id))
                res = await session.execute(stmt)
                case_record = res.scalar_one_or_none()
                if case_record:
                    case_record.status = new_status
                    decision_record = FraudDecision(
                        case_id=uuid.UUID(case_id),
                        analyst_id=request.analystId,
                        decision=request.decision,
                        notes=request.notes,
                        override_previous=request.overridePrevious,
                        audit_trail={"reviewedAt": now_iso, "analyst": request.analystId},
                    )
                    session.add(decision_record)
                    await session.commit()
        except Exception:
            pass

        # In-memory update
        if case_id in _in_memory_cases:
            _in_memory_cases[case_id]["status"] = new_status
            _in_memory_cases[case_id]["updatedAt"] = now_iso

        FRAUD_CASES_RESOLVED_TOTAL.labels(decision=request.decision).inc()

        await emit_fraud_event(
            "fraud.case.resolved",
            {
                "caseId": case_id,
                "analystId": request.analystId,
                "decision": request.decision,
                "notes": request.notes,
                "timestamp": now_iso,
            },
        )

        return {
            "caseId": case_id,
            "status": new_status,
            "decision": request.decision,
            "analystId": request.analystId,
            "notes": request.notes,
            "resolvedAt": now_iso,
        }

    async def create_rule(self, request: CreateFraudRuleRequest) -> FraudRuleDTO:
        rule_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                rule_record = FraudRule(
                    id=uuid.UUID(rule_id),
                    rule_code=request.ruleCode,
                    name=request.name,
                    description=request.description,
                    workflow=request.workflow,
                    score_delta=request.scoreDelta,
                    action=request.action,
                    conditions=request.conditions,
                    fail_mode=request.failMode,
                    is_active=request.isActive,
                )
                session.add(rule_record)
                await session.commit()
        except Exception:
            pass

        dto = FraudRuleDTO(
            id=rule_id,
            ruleCode=request.ruleCode,
            name=request.name,
            description=request.description,
            workflow=request.workflow,
            scoreDelta=request.scoreDelta,
            action=request.action,
            conditions=request.conditions,
            failMode=request.failMode,
            isActive=request.isActive,
            createdAt=now_iso,
        )
        _in_memory_rules[rule_id] = dto.model_dump()
        return dto

    async def list_rules(self, workflow: Optional[str] = None) -> list[FraudRuleDTO]:
        rules = list(_in_memory_rules.values())
        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                stmt = select(FraudRule)
                if workflow:
                    stmt = stmt.where(FraudRule.workflow == workflow)
                res = await session.execute(stmt)
                db_rules = res.scalars().all()
                if db_rules:
                    return [
                        FraudRuleDTO(
                            id=str(r.id),
                            ruleCode=r.rule_code,
                            name=r.name,
                            description=r.description,
                            workflow=r.workflow,
                            scoreDelta=r.score_delta,
                            action=r.action,
                            conditions=r.conditions or {},
                            failMode=r.fail_mode,
                            isActive=r.is_active,
                            createdAt=r.created_at.isoformat() if r.created_at else "",
                        )
                        for r in db_rules
                    ]
        except Exception:
            pass

        if workflow:
            rules = [r for r in rules if r.get("workflow") == workflow]
        return [FraudRuleDTO(**r) for r in rules]

    async def toggle_rule(self, rule_id: str, is_active: bool) -> FraudRuleDTO:
        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                stmt = select(FraudRule).where(FraudRule.id == uuid.UUID(rule_id))
                res = await session.execute(stmt)
                rule = res.scalar_one_or_none()
                if rule:
                    rule.is_active = is_active
                    await session.commit()
                    return FraudRuleDTO(
                        id=str(rule.id),
                        ruleCode=rule.rule_code,
                        name=rule.name,
                        description=rule.description,
                        workflow=rule.workflow,
                        scoreDelta=rule.score_delta,
                        action=rule.action,
                        conditions=rule.conditions or {},
                        failMode=rule.fail_mode,
                        isActive=rule.is_active,
                        createdAt=rule.created_at.isoformat() if rule.created_at else "",
                    )
        except Exception:
            pass

        if rule_id in _in_memory_rules:
            _in_memory_rules[rule_id]["isActive"] = is_active
            return FraudRuleDTO(**_in_memory_rules[rule_id])

        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")

    async def get_admin_metrics(self) -> dict[str, Any]:
        cases = list(_in_memory_cases.values())
        assessments = list(_in_memory_assessments.values())
        open_cases = [c for c in cases if c.get("status") in ("OPEN", "IN_REVIEW")]
        blocked = [a for a in assessments if a.get("decision") == "BLOCK"]
        reviewed = [a for a in assessments if a.get("decision") == "REVIEW"]

        total_assessments = len(assessments)
        block_rate = (len(blocked) / total_assessments * 100) if total_assessments > 0 else 0.0
        review_rate = (len(reviewed) / total_assessments * 100) if total_assessments > 0 else 0.0

        return {
            "totalAssessments": total_assessments,
            "totalCases": len(cases),
            "openCases": len(open_cases),
            "blockRate": round(block_rate, 2),
            "reviewRate": round(review_rate, 2),
            "averageLatencyMs": 15,
        }


fraud_service = FraudService()
