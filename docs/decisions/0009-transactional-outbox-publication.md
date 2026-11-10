# ADR 0009 — Transactional outbox and BullMQ handoff

**Status:** Accepted for implemented publisher scope; worker deferred. Recorded retrospectively on 2026-11-10.

## Context and decision

Persist a new help request, its idempotency result, and one identifier-only `help-request-submitted` outbox event in the same PostgreSQL transaction. After commit, an API publisher polls pending events and submits BullMQ jobs through Redis using stable event-derived job IDs. Mark the outbox event enqueued only after the queue accepts the job. Keep requester data out of event/job payloads.

## Consequences

PostgreSQL remains the durable acceptance boundary and Redis unavailability does not undo a valid committed request. Publication is at least once; a stable job ID supports retries but does not establish exactly-once external effects. Enqueueing is not business processing: a worker and `processed_at` transition remain deferred. Unit and database tests use a BullMQ double; real Redis and manual Redis Insight verification remain pending.

## Evidence

- [Iteration 008 Checkpoints 4A–4D](../iterations/008-public-help-request-intake.md)
- [Outbox migration](../../apps/api/drizzle/20261102222316_jittery_umar/migration.sql), [intake transaction](../../apps/api/src/help-requests/help-requests.service.ts), and [publisher](../../apps/api/src/outbox-publisher/)
