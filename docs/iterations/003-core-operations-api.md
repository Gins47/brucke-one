# Iteration 003 — Core Operations API

**Project:** BruckeOne  
**Status:** Checkpoint 1 complete; awaiting review
**Goal:** Implement the V1 REST API for the core operational domain using NestJS modules, typed DTO validation, focused services, and focused HTTP/database tests.

## Preconditions

- Iteration 002 migration is applied successfully to the local development database.
- Core database constraints are verified with integration tests.
- No authentication or authorization is implemented in this iteration.

## API conventions

- Use REST endpoints under the relevant plural resource path.
- Validate request DTOs and UUID path parameters.
- Return `400 Bad Request` for invalid input, `404 Not Found` for unknown resources, and `409 Conflict` for database/business conflicts.
- Keep controllers thin; feature services own use cases and persistence calls.
- Use partial updates: omitted fields remain unchanged.
- Document exported or non-obvious functions briefly.
- Do not create generic repositories or a generic CRUD framework.

## Checkpoint 1 — API foundation [x]

- Use the installed Zod for request validation. NestJS remains on 11.2.7; `StandardSchemaValidationPipe` is unavailable in this version.
- Use the project-owned `ZodValidationPipe` explicitly on request bodies. It uses `safeParse`, returns Zod's parsed output, and returns structured HTTP 400 errors for invalid input.
- Define request schemas next to the relevant module's DTO/request definitions and infer their TypeScript input/output types there.
- Use `z.strictObject()` to reject unknown request fields.
- Use NestJS `ParseUUIDPipe` for UUID route parameters.
- Add no validation decorators, generic validation framework, or Standard Schema compatibility layer.
- Verify the validation-pipe tests, existing unit tests, build, and lint.

**Stop for review.**

## Checkpoint 2 — Organizations API

Endpoints:

```text
POST  /organizations
GET   /organizations
GET   /organizations/:id
PATCH /organizations/:id
```

Rules:

- `code` and `name` are required at creation.
- `code` is immutable after creation.
- `PATCH` may update only `name`, `contactEmail`, `contactPhone`, and `officeAddress`.
- `null` clears optional contact fields; omitted fields remain unchanged.
- No delete endpoint in V1.

Focused tests:

- Create organization successfully.
- Duplicate code returns `409 Conflict`.
- Get/update unknown organization returns `404 Not Found`.
- Partial update changes only supplied fields.
- Attempting to update `code` is rejected.

**Stop for review.**

## Checkpoint 3 — Emergency Operations API

Endpoints:

```text
POST  /emergency-operations
GET   /emergency-operations
GET   /emergency-operations/:id
PATCH /emergency-operations/:id
```

Rules:

- Creation requires an existing organization.
- Operation code is unique within its organization.
- Status lifecycle rules must be explicitly defined before implementation.
- No delete endpoint in V1; completed and cancelled operations remain historical records.

Focused tests:

- Create under an existing organization.
- Unknown organization returns a meaningful error.
- Duplicate operation code within one organization returns `409 Conflict`.
- Invalid status or time-range input returns `400 Bad Request`.

**Stop for review.**

## Checkpoint 4 — Shelters API

Endpoints:

```text
POST  /shelters
GET   /shelters
GET   /shelters/:id
PATCH /shelters/:id
```

Rules:

- Creation requires an existing organization.
- Shelter code is unique within its organization.
- Validate capacity and coordinate input.
- No delete endpoint in V1.

Focused tests:

- Create a valid shelter.
- Invalid capacity or coordinates return `400 Bad Request`.
- Duplicate shelter code within one organization returns `409 Conflict`.
- Partial update preserves omitted fields.

**Stop for review.**

## Checkpoint 5 — Shelter Activation workflows

Endpoints:

```text
POST /shelter-activations
GET  /shelter-activations
GET  /shelter-activations/:id
POST /shelter-activations/:id/deactivate
```

Rules:

- Creating an activation means activating a shelter.
- Deactivation updates the existing activation; it does not delete it.
- The shelter and operation must belong to the same organization.
- A shelter may have only one active activation.
- Use a transaction only when a single workflow changes multiple records atomically.

Focused tests:

- Valid same-organization activation succeeds.
- Cross-organization activation returns a conflict.
- A second active activation for the same shelter returns `409 Conflict`.
- Deactivation retains the record and allows a later activation.

**Stop for review.**

## Checkpoint 6 — Affected-region workflows

Endpoints:

```text
POST   /emergency-operations/:id/affected-regions
GET    /emergency-operations/:id/affected-regions
DELETE /emergency-operations/:id/affected-regions/:regionId
```

Rules:

- The `DELETE` endpoint is a logical removal: set `removed_at`; do not delete the row.
- The default list returns current regions only.
- Support an explicit history option later if needed.

Focused tests:

- Add an affected region.
- Reject a duplicate current region.
- Remove a region by setting `removed_at`.
- Allow the same region to be added again after removal.

**Stop for review.**

## Out of scope

- Authentication, users, roles, or organization-scoped authorization.
- Pagination, filtering, search, and dashboard queries.
- PostGIS, map rendering, external region-boundary providers.
- AI, RAG, protocols, notifications, queues, and background workers.
- Generic delete endpoints for historical operational data.

## Completion criteria

- Every checkpoint is reviewed before proceeding.
- Relevant build, lint, unit, integration, and E2E checks pass.
- Tests are focused on contracts, business rules, and database invariants.
- API behavior and important decisions are documented.
- No changes outside this iteration are introduced.
