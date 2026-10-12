# BruckeOne API — Codex Instructions

## Scope

This file applies to work under `apps/api/`. Follow the repository-root `AGENTS.md` and `docs/architecture/overview.md` as well. The active document under `docs/iterations/` determines what is authorized for implementation.

The API is the **NestJS / TypeScript modular monolith** responsible for operational business logic and the authoritative HTTP interface. It must remain **stateless across requests**; do not depend on in-memory state for durable workflows or correctness across instances.

## Technology and structure

- Use **NestJS**, **Drizzle ORM**, **PostgreSQL 18 with pgvector**, and the `pg` driver.
- Organize code by domain/feature (e.g., organizations, operations, shelters, shelter activations) with clear module boundaries.
- Keep controllers thin: validate and translate HTTP requests; put business rules in services/domain code.
- Prefer explicit NestJS module imports over making the database module global.
- Create **one shared `pg.Pool` per API process** through NestJS dependency injection; release the pool on application shutdown. Never create a new pool per HTTP request.
- Use environment-based configuration. Never hardcode credentials or commit `.env` secrets.
- Avoid unnecessary generic repositories, frameworks, abstractions, and dependencies.

## Database practices

- Define schemas using Drizzle and make changes through **reviewed, version-controlled Drizzle migrations**.
- Do not use automatic schema synchronization or `drizzle-kit push` against persistent environments as a substitute for migrations.
- Enforce uniqueness, referential integrity, and concurrency-sensitive invariants in PostgreSQL.
- Use short transactions for multi-write operations; do not hold locks across calls to external services.
- For shelter activations, retain historical records and enforce at most one `ACTIVE` activation per physical shelter in V1.
- Never reset, drop, or recreate existing database volumes or data without explicit user approval.
- Treat pgvector as an available database capability, not a requirement to add embeddings or RAG before the relevant iteration.

## API quality and security

- Use typed DTOs and request validation; provide predictable HTTP status codes and error responses.
- Do not expose database internals or sensitive data in API errors or logs.
- Keep personally identifiable resident/volunteer information minimal and avoid introducing collection of real personal data without explicit authorization and privacy design.
- Do not let future AI components bypass business validations, authorization, or human approvals.
- Prefer explicit, testable behavior over implicit ORM hooks or hidden side effects.

## Tests and verification

- Add unit tests for meaningful domain logic and integration tests for database behavior, constraints, migrations, and transaction-sensitive flows.
- Run applicable typecheck/build, lint, and tests; report the actual commands and outcomes.
- If Docker or PostgreSQL is unavailable, say so; do not claim database integration tests passed.
- Check migrations' generated SQL for unintended changes before applying them.

## Codex checkpoint workflow

1. Read the relevant approved checkpoint in `docs/iterations/` and inspect existing code and Git status.
2. Implement **only** the checkpoint explicitly requested by the user.
3. Preserve existing setup and unrelated changes; ask before altering architecture or adding infrastructure.
4. Verify changes and report files changed, commands/results, decisions, and unresolved risks.
5. Stop for review. Do not proceed to another checkpoint or commit unless explicitly instructed.
