"""initial fraud detection schema

Revision ID: 001_initial_fraud_schema
Revises: 
Create Date: 2026-11-04 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_fraud_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. fraud_rules
    op.create_table(
        "fraud_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rule_code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("workflow", sa.String(length=32), nullable=False),
        sa.Column("score_delta", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=16), nullable=False, server_default="FLAG"),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("fail_mode", sa.String(length=16), nullable=False, server_default="FAIL_CLOSED"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_fraud_rules_rule_code", "fraud_rules", ["rule_code"], unique=True)
    op.create_index("ix_fraud_rules_workflow", "fraud_rules", ["workflow"])
    op.create_index("ix_fraud_rules_is_active", "fraud_rules", ["is_active"])

    # 2. risk_assessments
    op.create_table(
        "risk_assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=128), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=True),
        sa.Column("seller_id", sa.String(length=128), nullable=True),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("decision", sa.String(length=16), nullable=False),
        sa.Column("reason_summary", sa.Text(), nullable=False),
        sa.Column("fail_mode_used", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("assessment_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_risk_assessments_workflow", "risk_assessments", ["workflow"])
    op.create_index("ix_risk_assessments_entity_id", "risk_assessments", ["entity_id"])
    op.create_index("ix_risk_assessments_user_id", "risk_assessments", ["user_id"])
    op.create_index("ix_risk_assessments_decision", "risk_assessments", ["decision"])
    op.create_index("ix_risk_assessments_created_at", "risk_assessments", ["created_at"])

    # 3. risk_signals
    op.create_table(
        "risk_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("risk_assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signal_name", sa.String(length=128), nullable=False),
        sa.Column("signal_value", sa.String(length=256), nullable=False),
        sa.Column("score_delta", sa.Integer(), nullable=False),
        sa.Column("signal_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_risk_signals_assessment_id", "risk_signals", ["assessment_id"])
    op.create_index("ix_risk_signals_signal_name", "risk_signals", ["signal_name"])

    # 4. fraud_cases
    op.create_table(
        "fraud_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("risk_assessments.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("workflow", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="OPEN"),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="MEDIUM"),
        sa.Column("assigned_to", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_fraud_cases_assessment_id", "fraud_cases", ["assessment_id"])
    op.create_index("ix_fraud_cases_status", "fraud_cases", ["status"])
    op.create_index("ix_fraud_cases_workflow", "fraud_cases", ["workflow"])

    # 5. fraud_decisions
    op.create_table(
        "fraud_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("fraud_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analyst_id", sa.String(length=128), nullable=False),
        sa.Column("decision", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("override_previous", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("audit_trail", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_fraud_decisions_case_id", "fraud_decisions", ["case_id"])

    # 6. risk_model_versions
    op.create_table(
        "risk_model_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("model_name", sa.String(length=128), nullable=False),
        sa.Column("algorithm", sa.String(length=64), nullable=False),
        sa.Column("hyperparameters", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("trained_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_risk_model_versions_model_name", "risk_model_versions", ["model_name"])


def downgrade() -> None:
    op.drop_table("risk_model_versions")
    op.drop_table("fraud_decisions")
    op.drop_table("fraud_cases")
    op.drop_table("risk_signals")
    op.drop_table("risk_assessments")
    op.drop_table("fraud_rules")

