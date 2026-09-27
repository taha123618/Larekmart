# @repo/user-db

Prisma ORM client and database schema for Larekmart's `user-service`.

## Purpose
Manages PostgreSQL persistent storage for customer profiles, saved addresses, localization and marketing preferences, and event deduplication tables.

## Usage
\`\`\`ts
import { prisma, disconnectPrisma } from "@repo/user-db";
\`\`\`
