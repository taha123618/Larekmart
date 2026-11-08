# AGENTS.md — apps/fraud-service (Real-Time Risk Scoring & Fraud Detection Engine)

Scope: `apps/fraud-service` only. Monorepo root rules (`AGENTS.md`) always apply.

## What this service is

The **Fraud Detection Service** is an enterprise-grade, low-latency microservice for Larekmart built with **Python 3.12+ (FastAPI), SQLAlchemy 2.0 (asyncpg), PostgreSQL (`fraud_db`), Redis, Kafka (`aiokafka`), scikit-learn, and NumPy/Pandas**. It evaluates risk across payment transactions, high-velocity checkouts, promotion voucher abuse, account takeovers, and seller payout operations.

## Architecture & Layout

- `app/main.py` — FastAPI application factory, lifespan management, CORS, routers on port `8024`.
- `app/core/config.py` — Pydantic Settings reading environment variables.
- `app/core/logging.py` — Structured JSON logging via `structlog`.
- `app/core/security.py` — Constant-time `x-internal-secret` verification and Clerk Admin JWT verification.
- `app/db/session.py` — SQLAlchemy 2.x async engine (`asyncpg`) and async sessionmaker.
- `app/db/models.py` — SQLAlchemy models for `fraud_rules`, `risk_assessments`, `risk_signals`, `fraud_cases`, `fraud_decisions`, and `risk_model_versions`.
- `app/redis/velocity.py` — Redis sorted-set sliding window rate limiter and velocity counter.
- `app/engine/rules_engine.py` — Configurable rule evaluation engine with fail-open and fail-closed handling.
- `app/engine/ml_engine.py` — scikit-learn anomaly scoring (IsolationForest / baseline feature scaling).
- `app/kafka/` — Asynchronous Kafka producer and concurrent batch consumer (`aiokafka`) with bounded worker pools (`asyncio.gather` + `asyncio.Semaphore(10)`) eliminating consumer partition lag during burst traffic.
- `app/schemas/fraud.py` — Pydantic v2 schemas for request, response, and database transfer objects.
- `app/services/fraud_service.py` — Orchestrator coordinating velocity tracking, rule evaluation, ML anomaly detection, case generation, and Kafka event dispatch.
- `app/api/internal.py` — Internal endpoints (`POST /api/v1/internal/fraud/assess`, `GET /api/v1/internal/fraud/assessments/{id}`).
- `app/api/admin.py` — Admin investigation endpoints (`GET /api/v1/admin/fraud/cases`, `POST /api/v1/admin/fraud/cases/{id}/review`, `POST /api/v1/admin/fraud/rules`).
- `app/api/health.py` — Liveness/readiness probe (`/health`) and Prometheus metrics (`/metrics`).

## Invariants & Guardrails

1. **Explainable Scoring**: Rules always provide deterministic risk signals before ML inference.
2. **Fail-Open vs Fail-Closed**: Payouts and Payments fail-closed or flag for review on engine degradation. Promotions fail-open with alerts.
3. **Audit Trail**: Every analyst review creates an immutable `fraud_decisions` entry.
4. **Zero-Trust**: Internal endpoints require constant-time `x-internal-secret` validation. Admin endpoints require verified Clerk Admin credentials.
