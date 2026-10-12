# Iteration 001 — Project Foundation

**Project:** BruckeOne  
**Status:** Planned / partially initialized  
**Implementation agent:** Codex  
**Review:** Checkpoint-by-checkpoint, with user approval

## Goal

Establish a reproducible, tested backend foundation using NestJS, TypeScript, Drizzle ORM, and PostgreSQL with pgvector. Reuse the repository and Docker Compose setup already created. Do not implement business-domain endpoints in this iteration.

## Existing setup — inspect before changing

The repository already has an initial project structure and a Docker Compose configuration. The current database service uses:

- Image: `pgvector/pgvector:0.8.6-pg18`
- Service: `postgres`, container: `brucke-postgres`
- Database: `brucke_one`, user: `brucke`
- Named volume mounted at `/var/lib/postgresql`
- Initialization script: `./infra/postgresql/init.sql`

**Codex must inspect actual files and Git status first.** Do not assume any discussed files exist unless present. Preserve working configuration and unrelated changes. Do not recreate the NestJS project, overwrite Compose, delete volumes, or run destructive database commands.

## Agreed architecture decisions

1. **Backend:** NestJS with TypeScript.
2. **Architecture:** Modular monolith; stateless HTTP API. Do not rely on process-local state for business correctness.
3. **Database:** PostgreSQL 18 with pgvector available for later AI/RAG features. No vector schema or AI features now.
4. **Data access:** Drizzle ORM and `pg` driver, using one shared `pg.Pool` per NestJS application instance.
5. **Dependency injection:** Prefer explicit `DatabaseModule` imports over a global module.
6. **Schema evolution:** Version-controlled Drizzle Kit SQL migrations. Do not use automatic schema synchronization on application startup or `drizzle-kit push` as the deployment migration mechanism.
7. **Local development:** Reuse Docker Compose. Bind the database port to `127.0.0.1` if it is not already restricted, after confirming no project-specific reason to expose it.
8. **Configuration:** Load `DATABASE_URL` from environment; provide `.env.example` without secrets and ensure real `.env` files are ignored.
9. **Lifecycle:** Close the PostgreSQL pool during NestJS application shutdown.
10. **Future domain model (not implemented here):** Organization, Emergency Operation, Shelter, and Shelter Activation. A physical shelter is independent of an operation, historical activations are retained, and only one activation may be ACTIVE per shelter.

## Checkpoint 1 — Inspect and verify the existing foundation

### Tasks

- Inspect repository layout, package scripts, Compose file, PostgreSQL init script, Git status, and existing NestJS app.
- Confirm PostgreSQL starts and the health check passes.
- Verify the `vector` extension exists in the target database; if not, identify whether the initialization script has run. Avoid deleting the volume to force initialization.
- Identify configuration issues, missing dependencies, or inconsistencies and make only minimal, justified changes.
- Confirm local-only database port binding and safe handling of development credentials.

### Acceptance criteria

- Existing NestJS app starts without errors.
- PostgreSQL container is healthy.
- Database connection and pgvector extension are verified.
- No existing data or project files are lost.
- A concise checkpoint report lists commands executed, results, and changes.

**Stop for review after Checkpoint 1.**

## Checkpoint 2 — Database module and migration tooling

### Tasks

- Install missing dependencies as needed: `drizzle-orm`, `pg`, `@nestjs/config`, `dotenv`, `drizzle-kit`, `@types/pg`.
- Add a typed Drizzle client provider backed by a shared `pg.Pool`.
- Implement `DatabaseModule` with explicit exports/imports and proper pool shutdown on application termination.
- Configure Drizzle Kit for PostgreSQL, with schema files under `src/database/schema/` and migrations under a version-controlled directory.
- Add migration scripts (`db:generate`, `db:migrate`) and an `.env.example`.
- Add a minimal database integration test or verification that executes `SELECT 1` using the configured provider.
- Ensure app startup does not automatically execute migrations.

### Acceptance criteria

- NestJS starts with the database provider configured.
- Integration test confirms a working PostgreSQL connection.
- Migration tooling is configured and documented, without generating an empty or speculative business migration.
- Pool resources are closed cleanly.
- Tests, linting, and build pass, or any failures are reported precisely.

**Stop for review after Checkpoint 2.**

## Out of scope

- Organization CRUD and business tables (next iteration)
- Shelter activation constraints and reservations
- Authentication and authorization
- Redis, RabbitMQ, outbox, background workers
- AI service, embeddings, vector search, RAG
- Kubernetes, AWS deployment, and production hardening
- New monorepo tooling unless an existing configuration requires it

## Implementation rules for Codex

1. Work on **one checkpoint at a time**; do not proceed without approval.
2. Inspect before editing; preserve existing structure and user changes.
3. Prefer the smallest maintainable implementation; avoid speculative abstractions.
4. Explain meaningful architectural choices and deviations from this plan.
5. Add or update tests for changed behavior.
6. Do not commit automatically or modify unrelated files.
7. Do not reset PostgreSQL volumes or destroy data.
8. At checkpoint completion, report: files changed, commands/tests run, results, risks, and questions.

## Checkpoint review checklist

- Scope matches approved checkpoint.
- Database credentials are not committed.
- No accidental schema synchronization or destructive migration behavior.
- Dependency injection and pool lifecycle are correct.
- Configuration errors fail clearly.
- Tests verify actual behavior rather than only mocks.
- No unnecessary infrastructure or business features were introduced.

## Next iteration

**Iteration 002 — Core Domain:** Organization, Emergency Operation, Shelter, and Shelter Activation schemas, migrations, API endpoints, validation, and integration tests. Enforce at most one ACTIVE activation per physical shelter with a PostgreSQL partial unique index.
