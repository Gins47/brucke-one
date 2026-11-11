# ADR 0007 — Activation-specific shelter availability snapshots

**Status:** Accepted for current implementation; recorded retrospectively on 2026-11-10.

## Context and decision

Record at most one current availability snapshot per shelter activation. Treat the absence of a report as unknown rather than zero. Store operational capacity, occupancy, reserved places, acceptance status, note, and report time; derive available places as operational capacity minus occupancy minus reserved places. PostgreSQL enforces non-negative values and occupancy plus reserved places within operational capacity.

The API replaces the complete snapshot only while the activation and operation are active. It locks related rows and validates operational capacity against the physical shelter capacity in that write path. Dashboard totals include reported values only and disclose coverage.

## Consequences

Reported reserved places are snapshot values, not person-level reservation records. Later matching and reservation behavior is not implemented by this decision. Reports remain available after closure. The current shelter update path can reduce physical capacity below an existing report's operational capacity, so the cross-table relationship is not maintained by every write path. The checked-in tests also do not exercise a real concurrent PostgreSQL report/parent-transition race; see [Iteration 007](../iterations/007-shelter-availability-and-readiness.md).

## Evidence

- [Iteration 007 domain and lifecycle](../iterations/007-shelter-availability-and-readiness.md)
- [Availability migration](../../apps/api/drizzle/20261023203918_serious_doctor_octopus/migration.sql) and [write service](../../apps/api/src/shelters/availability/shelter-activation-availability.service.ts)
- [Dashboard projection](../../apps/api/src/dashboard/dashboard.service.ts)
