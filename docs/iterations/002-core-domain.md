# Iteration 002 — Core Domain Data Model

**Project:** BruckeOne  
**Status:** Schema implemented; required constraint-test coverage partial
**Goal:** Define and implement the core operational database model for organizations, emergency operations, shelters, shelter activations, and affected regions.

## Current checkpoint assessment

**Reconciled:** 2026-11-10. Later acceptance is recorded in Iteration 008; this assessment distinguishes source evidence from historical process records. See the [status definitions](README.md). Tests were inspected, not rerun.

| Checkpoint | Current status | Evidence and remaining work |
| --- | --- | --- |
| 1 — Review and approve document | Historically recorded | The original checklist records approval; Iteration 008 lists iterations 001–007 as accepted. Code cannot establish a new approval. |
| 2 — Schemas and migration | Implemented | [Schemas](../../apps/api/src/database/schema/) and the [core migration](../../apps/api/drizzle/20261012122205_past_swordsman/migration.sql) define composite organization foreign keys, partial uniqueness, and numeric/time checks. Organizations were introduced in a preceding migration. |
| 3 — Inspect SQL before application | Historically recorded | The original checklist records SQL inspection; current SQL does not prove the historical review event. |
| 4 — Apply to local development database | Historically recorded; environment unverified | The original checklist records application. No persistent database was inspected or migrated in this reconciliation. |
| 5 — All required constraint tests | Partial coverage | [Core constraint tests](../../apps/api/test/core-domain-constraints.e2e-spec.ts) cover cross-organization activation, sequential active-activation uniqueness, current-region uniqueness/reuse, and operation timeline checks. [Activation HTTP tests](../../apps/api/test/shelter-activations.e2e-spec.ts) cover valid activation and historical reuse. Direct database tests for missing organization references, invalid shelter capacity/coordinates, and concurrent active-activation inserts are absent. HTTP validation tests do not replace these database tests. |
| 6 — Stop for review | Historically recorded | Later delivery moved on to Iteration 003; no new acceptance is inferred here. |

**Decisions:** [Historical domain integrity](../decisions/0002-historical-domain-integrity.md).

## Starting point

The `organizations` Drizzle schema and its initial migration already exist and were applied successfully to the local development database during connection testing. They are accepted as the first Iteration 002 artifact.

Iteration 001 remains responsible for database infrastructure only. Before completing this iteration, add the missing Drizzle scripts and restrict the local PostgreSQL port to `127.0.0.1`.

## Scope

This iteration implements:

- Drizzle schemas and reviewed PostgreSQL migrations.
- Database constraints, foreign keys, indexes, and integration tests.
- No authentication, authorization, UI, AI service, background workers, notifications, or PostGIS.
- No business API endpoints until the data model and constraint tests are reviewed.

## Core model

```text
Organization 1 ─── N EmergencyOperation
Organization 1 ─── N Shelter

EmergencyOperation 1 ─── N ShelterActivation
Shelter            1 ─── N ShelterActivation

EmergencyOperation 1 ─── N OperationAffectedRegion
```

## Tables

### Organizations

Existing table.

```text
organizations
- id
- code
- name
- contact_email
- contact_phone
- office_address
- created_at
- updated_at
```

Rules:

- `id` is the UUID primary key.
- `code` is unique.
- Organization records are not deleted while dependent operational data exists.

### Emergency operations

```text
emergency_operations
- id
- organization_id
- operation_code
- name
- description nullable
- country_code
- type
- severity
- status
- started_at nullable
- ended_at nullable
- created_at
- updated_at
```

Rules:

- `id` is the UUID primary key.
- `organization_id` references `organizations(id)`.
- `UNIQUE (organization_id, operation_code)`.
- Add `UNIQUE (id, organization_id)` to support composite foreign keys from shelter activations.
- Status lifecycle for V1: `PLANNED`, `ACTIVE`, `COMPLETED`, `CANCELLED`.
- Type values for V1: `FLOOD`, `FIRE`, `EARTHQUAKE`, `OTHER`.
- Severity values for V1: `LOW`, `MEDIUM`, `HIGH`.
- `ended_at` must not be earlier than `started_at`.
- `country_code` is an ISO-style two-letter country code; API validation will enforce its exact format later.

### Shelters

A shelter is a reusable physical facility, not an operation-specific record.

```text
shelters
- id
- organization_id
- shelter_code
- name
- address
- country_code
- latitude nullable
- longitude nullable
- capacity
- contact_email nullable
- contact_phone nullable
- created_at
- updated_at
```

Rules:

- `id` is the UUID primary key.
- `organization_id` references `organizations(id)`.
- `UNIQUE (organization_id, shelter_code)`.
- Add `UNIQUE (id, organization_id)` to support composite foreign keys from shelter activations.
- `capacity >= 0`.
- Latitude must be between `-90` and `90`.
- Longitude must be between `-180` and `180`.
- Latitude and longitude must either both be present or both be absent.
- A shelter is shown as a map pin using latitude and longitude. PostGIS is deliberately out of scope for V1.

### Shelter activations

A shelter activation connects one physical shelter to one emergency operation while preserving history.

```text
shelter_activations
- id
- organization_id
- shelter_id
- emergency_operation_id
- status
- activated_at
- deactivated_at nullable
- created_at
- updated_at
```

Rules:

- `id` is the UUID primary key.
- V1 status values: `ACTIVE`, `DEACTIVATED`.
- `deactivated_at` must not be earlier than `activated_at`.
- `ACTIVE` activations must have `deactivated_at` unset; `DEACTIVATED` activations must have `deactivated_at` set.
- At most one active activation may exist for a physical shelter:

  ```sql
  UNIQUE (shelter_id) WHERE status = 'ACTIVE'
  ```

- The shelter and emergency operation must belong to the same organization. Enforce this using composite foreign keys:

  ```text
  (shelter_id, organization_id)
    → shelters (id, organization_id)

  (emergency_operation_id, organization_id)
    → emergency_operations (id, organization_id)
  ```

- Historical activation rows are retained; they are not deleted when a shelter is deactivated.

### Operation affected regions

An emergency operation can affect several states or regions. The dashboard displays only current regions, while removed regions remain available as history.

```text
operation_affected_regions
- id
- emergency_operation_id
- country_code
- region_code
- region_name
- added_at
- removed_at nullable
- created_at
- updated_at
```

Rules:

- `emergency_operation_id` references `emergency_operations(id)`.
- `region_code` uses a standardized subdivision code where available, such as `DE-BY`.
- The dashboard queries current regions using `removed_at IS NULL`.
- `removed_at` must not be earlier than `added_at`.
- Prevent duplicate current region assignments with a partial unique index:

  ```sql
  UNIQUE (emergency_operation_id, country_code, region_code)
  WHERE removed_at IS NULL
  ```

- Adding an affected region inserts a row.
- Removing a region sets `removed_at`; it does not delete the row.
- The frontend can map standardized region codes to GeoJSON boundaries. Storing geographic polygons and PostGIS queries are future work.

## Database design principles

- PostgreSQL is the source of truth for referential integrity and concurrency-sensitive rules.
- Drizzle schemas are the source for generated, version-controlled migrations.
- No automatic schema synchronization runs at application startup.
- Use restrictive foreign-key behavior; do not cascade-delete historical operational records.
- Status values must be database-enforced, using PostgreSQL enums or checked text values.
- `created_at` and `updated_at` are required on all operational tables.

## Required integration tests

1. An emergency operation cannot reference a non-existent organization.
2. A shelter cannot reference a non-existent organization.
3. A shelter activation succeeds when its shelter and operation belong to the same organization.
4. A shelter activation fails when the shelter and operation belong to different organizations.
5. Two active activations for the same shelter cannot exist, including under concurrent insert attempts.
6. A deactivated historical activation does not block a later activation of the same shelter.
7. Duplicate current affected-region rows are rejected.
8. A removed affected-region row allows the same region to be added again later.
9. Capacity and coordinate constraints reject invalid shelter data.

## Checkpoints

1. [x] Review and approve this document.
2. [x] Implement Drizzle schemas and generate one reviewed migration.
3. [x] Inspect migration SQL before applying it.
4. [x] Apply the migration only to the local development database.
5. [~] Add and run integration tests for all listed constraints. The earlier checklist marked this complete; the current assessment above identifies direct database cases not present in today's test suite.
6. Stop for review before implementing controllers, DTOs, or services.

Protocols and RAG knowledge base are deferred to a dedicated iteration.
They will require versioning, approval status, jurisdiction, source citations,
and human review before any AI-assisted recommendation is used operationally.
