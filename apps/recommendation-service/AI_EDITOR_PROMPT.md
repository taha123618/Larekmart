# Recommendation Service

## AI Editor Setup & Implementation Specification

> **Service:** `recommendation-service`  
> **Architecture:** Event-driven microservice  
> **Primary language:** Python  
> **API framework:** FastAPI  
> **Database:** PostgreSQL + pgvector  
> **Messaging:** Kafka  
> **Cache:** Redis  
> **Background processing:** Celery  
> **Machine Learning:** scikit-learn  
> **Containerization:** Docker

---

# 1. AI Editor Role

Act as a **Principal Python Engineer, Machine Learning Engineer, and Distributed Systems Architect**.

You are responsible for analyzing, designing, implementing, testing, documenting, and maintaining the complete `recommendation-service` inside this microservices e-commerce monorepo.

The implementation must be:

- production-ready
- scalable
- modular
- strongly typed
- testable
- observable
- fault tolerant
- event-driven
- independently deployable

Do not build a basic CRUD service.

Build a proper **recommendation and personalization platform** that can begin with deterministic recommendation strategies and progressively evolve into collaborative filtering, vector similarity, hybrid ranking, and machine-learning-based recommendations.

---

# 2. Project Context

This repository is a microservices-based e-commerce platform.

The recommendation service is responsible for analyzing customer behavior and product relationships to generate relevant product recommendations.

The service must integrate with other microservices through Kafka events and well-defined APIs.

The service should support:

- personalized recommendations
- product recommendations
- product similarity
- category recommendations
- trending products
- popular products
- frequently bought together
- recently viewed products
- user preferences
- collaborative filtering
- content-based recommendations
- embedding-based recommendations
- hybrid recommendation strategies
- recommendation ranking
- recommendation caching
- recommendation analytics
- model management
- scheduled recommendation generation
- product and user embeddings

---

# 3. Service Ownership

The recommendation service owns recommendation-specific information.

## Recommendation Service Owns

```text
user interactions
recommendation records
recommendation items
recommendation scores
recommendation strategies
user preference data
product recommendation metadata
product embeddings
user embeddings
model metadata
recommendation jobs
recommendation analytics metadata
processed event records