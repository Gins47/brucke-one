# ADR 0001 — Modular API and PostgreSQL persistence

**Status:** Accepted for current implementation; recorded retrospectively on 2026-11-10.

## Context and decision

Use a NestJS/TypeScript modular monolith with stateless API processes. PostgreSQL is the system of record. Feature modules explicitly import a shared database module, which owns one `pg.Pool` per API process and closes it on shutdown. Use Drizzle ORM with reviewed, version-controlled Drizzle Kit SQL migrations; do not synchronize schemas automatically at startup.

The local database image includes pgvector for potential future work. A capability in the image does not authorize embeddings, vector search, or an AI service.

## Consequences

This keeps transactional domain rules in one application and database while allowing API instances to avoid process-local durable state. Database constraints and short transactions protect critical invariants. Database setup, migration application, and runtime availability still require environment-specific verification. The current development Compose port binding and missing health check are tracked in [Iteration 001](../iterations/001-project-foundation.md).

## Evidence

- [Iteration 001 decisions and checkpoint assessment](../iterations/001-project-foundation.md)
- [Database provider](../../apps/api/src/database/database.service.ts), [Drizzle configuration](../../apps/api/drizzle.config.ts), and [migrations](../../apps/api/drizzle/)
- [Architecture overview](../architecture/overview.md)
