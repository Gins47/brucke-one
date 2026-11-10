# ADR 0003 — Explicit API validation and domain-owned commands

**Status:** Accepted for current implementation; recorded retrospectively on 2026-11-10.

## Context and decision

Use explicit NestJS feature controllers, typed request/response contracts, strict Zod schemas, the project-owned `ZodValidationPipe`, and UUID route validation. Keep HTTP translation in controllers and business operations in feature services. Updates change supplied mutable fields; operation and activation transitions use explicit commands. Do not add generic CRUD or repository abstractions merely to share structure.

## Consequences

Clients receive predictable validation, not-found, and conflict responses while feature modules retain ownership of writes. Preserving operation and activation history takes priority over generic delete endpoints. Authentication and later public-route exceptions were added after the original API iteration.

## Evidence

- [Iteration 003 API conventions and checkpoints](../iterations/003-core-operations-api.md)
- [Validation pipe](../../apps/api/src/common/validation/zod-validation.pipe.ts), [operation controller](../../apps/api/src/emergency-operations/emergency-operations.controller.ts), and [operation service](../../apps/api/src/emergency-operations/emergency-operations.service.ts)
