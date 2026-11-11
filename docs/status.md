# Project Status

**Last updated:** 2026-11-11

**Latest accepted iteration:** [008 — Public Help-Request Intake](iterations/008-public-help-request-intake.md)  
**Active implementation checkpoint:** [Iteration 009, Checkpoint 3](iterations/009-manual-shelter-assignment.md#checkpoint-3--operator-dashboard) implemented and verified; review and acceptance pending. Checkpoint 2 is accepted for the synthetic demo. Do not start another checkpoint without an explicit user request.

## Delivered capabilities

- NestJS API, PostgreSQL schemas, reviewed Drizzle migrations, and isolated database tests.
- Organizations, emergency operations, shelters, historical shelter activations, and affected regions.
- Development ADMIN authentication with application-wide access; organization selection and query scoping do not provide tenant isolation.
- Next.js operations and shelter dashboards, maps, and shelter availability reporting.
- Public help-request backend: active-operation listing, idempotent intake, short references, minimal status lookup, and a protected operator queue API.
- Transactional outbox persistence and a BullMQ publisher that enqueues identifier-only jobs. Enqueued jobs are not business-processed.

## Acceptance and verification evidence

Iteration 008 records acceptance of iterations 001–007 and completion of its backend intake and publisher scope. The [iteration index](iterations/README.md) and current assessment in each iteration distinguish code present today, historical acceptance, and outstanding verification.

The [final acceptance record](iterations/008-public-help-request-intake.md#7-final-verification-and-documentation) reports passing API unit tests, disposable PostgreSQL E2E tests, build, non-mutating lint, Drizzle check, and diff checks. These are historical results, not checks rerun when this status page was created. API tests use a BullMQ test double.

## Outstanding checks and limitations

- Development PostgreSQL Compose publishes port 5432 without a localhost-only binding and has no health check. Current database health, pgvector installation, and applied migrations were not established by the documentation reconciliation; see [Iteration 001](iterations/001-project-foundation.md).
- Some original direct PostgreSQL constraint tests are missing, including concurrent active-activation inserts; see [Iteration 002](iterations/002-core-domain.md).
- Concurrent assignment and availability attempts are tested without guaranteeing contention at a specific lock. Deterministic tests for competing assignments, assignment versus availability PUT, and parent closure remain follow-up work before real-world use.
- The shelter API now rejects physical-capacity decreases. Reports made inconsistent before that guard existed may still require correction before assignment.
- Desktop/mobile browser walkthrough and live map-tile checks remain unverified; see [Iteration 006](iterations/006-operations-dashboard-ui.md).
- Real Redis/BullMQ and manual Redis Insight verification remain pending; see [Checkpoint 4C](iterations/008-public-help-request-intake.md#4c-bullmq-outbox-publisher).
- BullMQ worker processing remains deferred.
- The public short-reference and duplicate-response contracts are limited to controlled synthetic data. Stronger verification, rate limiting, abuse protection, and privacy review remain required before real-world use.
- Production authentication, organization-level authorization, credential lifecycle, and token revocation remain deferred.

## Future work — not authorized

Iteration 009's manual assignment dashboard awaits review and final synthetic demo verification. Automatic matching, geocoding, QR/check-in, notifications, AI, and business processing of queue jobs remain future work.

## Maintenance

Update this file when a checkpoint is selected, implemented, reviewed, or accepted, or when an outstanding check is resolved. Distinguish implementation complete, review pending, accepted, and verification pending. Include links to evidence, retain unresolved limitations, and never infer approval from a roadmap or iteration number. Keep detailed checkpoint reports in their iteration documents.
