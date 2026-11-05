---
name: sla-escalation-engine
description: Use when authoring, modifying, testing, or debugging SLA policies, first response/resolution deadline calculations, team assignments, agent queues, escalations, or resolution analytics in support-service.
---

# SLA Policies, Agent Queues & Escalations Playbook — support-service

This playbook governs service-level agreements, team assignments, agent queue workload balancing, and escalations in `apps/support-service`.

## 1. SLA Calculation & Policies

- **Default Priority Deadlines:**
  - `CRITICAL`: First response within 15 minutes, resolution within 2 hours.
  - `HIGH`: First response within 30 minutes, resolution within 6 hours.
  - `MEDIUM`: First response within 2 hours, resolution within 24 hours.
  - `LOW`: First response within 4 hours, resolution within 48 hours.
  - `URGENT`: First response within 15 minutes, resolution within 1 hour.
- **Category Policy Overrides:**
  - If a category (`TicketCategory`) links a specific `TicketSlaPolicy`, its custom thresholds supersede default priority calculations.
- **SLA Breach Tracking:**
  - `firstResponseAt`: Recorded automatically upon the first public agent response.
  - `resolvedAt`: Recorded upon status transition to `RESOLVED` or `CLOSED`.
  - `slaBreached`: Computed dynamically if `resolvedAt > resolutionDueAt` or `firstResponseAt > firstResponseDueAt`.

## 2. Team Queues & Agent Workload Balancing

- **Support Teams:**
  - `TIER_1`: General customer inquiries, tracking, and basic product questions.
  - `TIER_2`: Complex technical issues, recurring defects, and checkout glitches.
  - `BILLING`: Payment discrepancies, chargebacks, and refund reconciliations.
  - `SELLER_OPS`: Merchant disputes, inventory mismatches, and storefront policy violations.
  - `ESCALATIONS`: Senior management escalations and executive priority reviews.
  - `LOGISTICS`: Lost packages, damaged shipments, and courier claims.
- **Assignment Protocol:**
  - Handled via `POST /api/v1/admin/support/tickets/:id/assign`.
  - Records an immutable `TicketAssignment` entry, updates `assignedAgentId` and `assignedTeam`, moves status to `IN_PROGRESS`, and emits `support.ticket.assigned`.
- **Escalation Protocol:**
  - Handled via `POST /api/v1/admin/support/tickets/:id/escalate`.
  - Flags `isEscalated: true`, sets `escalatedAt`, records `escalationReason`, bumps priority (e.g. to `CRITICAL`), and transitions ticket to the `ESCALATIONS` team queue.

## 3. Real-Time Socket.IO Synchronization

- Room scoping:
  - `ticket:${id}` — Live timeline messages and state updates.
  - `agent:${agentId}` — Direct notifications for assigned cases.
  - `team:${team}` — Shared queue updates for support team specialists.
  - `ticket:${id}:internal` — Staff-only broadcasts for internal notes.

## 4. Resolution Analytics

- **Endpoint:** `GET /api/v1/admin/support/analytics`
- **Computed Metrics:**
  - Status breakdown (`OPEN`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `RESOLVED`, `CLOSED`).
  - Priority breakdown and team queue distribution.
  - SLA breach rate percentage.
  - Average first response time (minutes).
  - Average resolution time (minutes).
  - Active agent workload ranking (`agentId`, `activeTickets`).
