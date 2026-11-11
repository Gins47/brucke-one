# ADR 0002 — Preserve operational history and enforce shelter ownership

**Status:** Accepted for current implementation; recorded retrospectively on 2026-11-10.

## Context and decision

A physical shelter is reusable across emergency operations. Model each use as a separate shelter activation, retaining deactivated rows and logically removed affected-region rows. Operations and shelters belong to organizations; composite foreign keys ensure that an activation's shelter and operation share its organization.

PostgreSQL enforces at most one active activation per physical shelter with a partial unique index. Restrictive foreign keys, status/timestamp checks, and capacity/coordinate checks protect historical and domain integrity.

## Consequences

A shelter can be reactivated after deactivation without deleting its earlier history. API services handle lifecycle commands and translate conflicts, while the database remains authoritative for cross-row uniqueness and references. Some originally requested direct database tests remain missing; see [Iteration 002](../iterations/002-core-domain.md).

## Evidence

- [Iteration 002 model and checkpoints](../iterations/002-core-domain.md) and [Iteration 003 activation workflows](../iterations/003-core-operations-api.md)
- [Core-domain migration](../../apps/api/drizzle/20261012122205_past_swordsman/migration.sql)
- [Activation service](../../apps/api/src/shelters/activations/shelter-activations.service.ts) and [affected-region service](../../apps/api/src/emergency-operations/affected-regions/operation-affected-regions.service.ts)
