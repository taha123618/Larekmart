# Synthesized Project Context

## Overview
Larekmart is an asynchronous event-driven microservices e-commerce platform for clothing apparel, built with a pnpm + Turborepo monorepo. It features two Next.js 15 frontends (`client` storefront and `admin` control portal), 15 polyglot backend microservices (Node.js, Go, Python), and 11 shared packages.

## Ingested Documentation Sources
- `docs/adr/0001-asynchronous-kafka-integration.md` (ADR, Locked)
- `docs/adr/0002-polyglot-persistence.md` (ADR, Locked)
- `docs/adr/0003-clerk-authentication.md` (ADR, Locked)
- `docs/adr/README.md` (DOC)
- `docs/PRD.md` & `PRD.md` (PRD)

## Target Audience & Personas
- **Customers**: Retail shoppers browsing clothing apparel, selecting variants, adding to cart, and checking out securely via Stripe.
- **Administrators**: E-commerce operations staff managing product catalog, tracking orders, reviewing revenue analytics, and managing user roles.
