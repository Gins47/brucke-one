# ADR 0004 — Read-only dashboard projections with keyset pagination

**Status:** Accepted for current implementation; recorded retrospectively on 2026-11-10.

## Context and decision

Provide dashboard-specific, read-only PostgreSQL projections in a dedicated NestJS module. Domain services retain ownership of commands. Return explicit DTOs, use bounded projection queries, and paginate organization operations using an opaque cursor over `updatedAt DESC, id DESC`, with optional status filtering.

Iteration 007 extended the map projection with activation availability and reported-only totals and added organization shelter reads. These are query scopes, not authorization boundaries.

## Consequences

The dashboard can consume current operational data without maintaining a second read store or calling write services. Shelter listing remains unpaginated for the small development dataset. The original query-plan review used small fixtures and did not justify new indexes at that time; it is not proof of current or production-scale performance.

## Evidence

- [Iteration 004 decisions and query-plan review](../iterations/004-dashboard-read-models.md)
- [Iteration 007 dashboard extensions](../iterations/007-shelter-availability-and-readiness.md)
- [Dashboard service](../../apps/api/src/dashboard/dashboard.service.ts), [DTOs](../../apps/api/src/dashboard/dashboard.dto.ts), and [pagination tests](../../apps/api/test/dashboard-operations.e2e-spec.ts)
