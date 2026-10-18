# Iteration 004 — Dashboard Read Models

**Status:** Checkpoint 4 complete; awaiting review
**Goal:** Provide read-only, dashboard- and map-ready API projections over the existing operational domain.

This iteration prepares the API for a future web dashboard and LangGraph AI service. It does not introduce a frontend, AI service, authentication, caching, or new domain write workflows.

## Architecture decisions

- Add a dedicated read-only `dashboard` NestJS module.
- Existing domain modules remain owners of writes and commands:
  - Organizations
  - Emergency Operations
  - Shelters
  - Shelter Activations
  - Operation Affected Regions
- The dashboard module may read across domain tables, but must not write to them.
- Use explicit Drizzle projection and aggregate queries. Do not reuse command-service methods to assemble dashboard responses.
- Return explicit dashboard DTOs, never raw database rows.
- Avoid N+1 queries.
- Read directly from PostgreSQL in V1 so operational data is always current.
- Do not add CQRS/event sourcing, duplicate read-model tables, caching, PostGIS, or a message broker in this iteration.
- Add indexes only after reviewing actual final query plans with `EXPLAIN`. Do not create speculative indexes or migrations.

## API conventions

- All routes are read-only `GET` endpoints.
- Unknown organization or operation IDs return `404 Not Found`.
- Invalid route parameters use Nest `ParseUUIDPipe`.
- Invalid query parameters return the existing structured `400 Bad Request` response.
- Responses are organization-scoped by route parameters. Authentication and authorization will enforce caller access in a later iteration.

## Dashboard endpoints

### 1. Organization overview

```http
GET /dashboard/organizations/:organizationId/overview
```

Returns one organization summary and operational counts.

```json
{
  "organization": {
    "id": "uuid",
    "code": "BAY-RELIEF",
    "name": "Bavarian Relief Organization"
  },
  "operationCounts": {
    "planned": 1,
    "active": 2,
    "completed": 4,
    "cancelled": 1
  },
  "shelterCount": 12,
  "activeShelterActivationCount": 3
}
```

Rules:

- Verify the organization exists before returning data.
- Counts must be calculated by database aggregate queries.
- `activeShelterActivations` counts rows with activation status `ACTIVE`.
- No pagination applies because this endpoint returns one aggregate response.

### 2. Organization operations list

```http
GET /dashboard/organizations/:organizationId/operations?limit=25&cursor=...&status=ACTIVE
```

Returns compact operation cards for dashboard lists.

Each item contains:

```json
{
  "id": "uuid",
  "operationCode": "BAY-FLD-2026-01",
  "name": "Bayern Flood 2026",
  "countryCode": "DE",
  "type": "FLOOD",
  "severity": "HIGH",
  "status": "ACTIVE",
  "startedAt": "2026-10-15T08:00:00.000Z",
  "endedAt": null,
  "updatedAt": "2026-10-15T09:30:00.000Z"
}
```

Query parameters:

- `limit` is optional.
  - Default: `25`
  - Maximum: `100`
  - Must be a positive integer.
- `cursor` is optional and opaque to API clients.
- `status` is optional and accepts one emergency-operation status enum value.

Pagination rules:

- Stable ordering is `updatedAt DESC, id DESC`.
- The cursor represents the last returned item’s `updatedAt` and `id`.
- The cursor must be validated and scoped to this endpoint’s ordering.
- The response shape is:

```json
{
  "items": [],
  "nextCursor": "opaque-cursor-or-null"
}
```

- Cursor pagination is used instead of offset pagination so results remain efficient and stable as operations are created or updated.

### 3. Emergency operation map projection

```http
GET /dashboard/emergency-operations/:operationId/map
```

Returns the data required to render one operation’s current map state.

```json
{
  "operation": {
    "id": "uuid",
    "organizationId": "uuid",
    "operationCode": "BAY-FLD-2026-01",
    "name": "Bayern Flood 2026",
    "countryCode": "DE",
    "type": "FLOOD",
    "severity": "HIGH",
    "status": "ACTIVE",
    "startedAt": "2026-10-15T08:00:00.000Z",
    "endedAt": null,
    "updatedAt": "2026-10-15T09:30:00.000Z"
  },
  "affectedRegions": [
    {
      "id": "uuid",
      "countryCode": "DE",
      "regionCode": "DE-BY",
      "regionName": "Bavaria",
      "addedAt": "2026-10-15T08:10:00.000Z"
    }
  ],
  "activeShelters": [
    {
      "shelterId": "uuid",
      "shelterCode": "MUC-001",
      "name": "Munich Community Hall",
      "address": "Example Street 10, 80331 Munich",
      "countryCode": "DE",
      "latitude": 48.1351,
      "longitude": 11.582,
      "capacity": 250,
      "contactEmail": "shelter@example.org",
      "contactPhone": "+49891234567",
      "activatedAt": "2026-10-15T08:30:00.000Z"
    }
  ],
  "unmappedActiveShelterCount": 0
}
```

Rules:

- Verify the operation exists before returning data.
- Return only current affected regions where `removedAt IS NULL`.
- Return only shelter activations with status `ACTIVE`.
- A shelter without both coordinates must not be included in `activeShelters`.
- Count omitted active shelters in `unmappedActiveShelterCount`.
- Return region codes and names only. The future frontend will resolve region codes to GeoJSON boundaries.
- Do not paginate this endpoint in V1: a map requires a complete view for one operation.
- A later frontend iteration may replace this with viewport/bounding-box queries and marker clustering if operation-scale data requires it.

## Checkpoints

### Checkpoint 1 — Dashboard module foundation [x]

Implement the read-only `dashboard` module structure.

Scope:

- Dashboard module, controller, service/repository boundary, response DTOs, and query DTOs.
- Module registration in `AppModule`.
- Shared conventions for dashboard `404`, query validation, and response mapping.
- No endpoint implementation beyond minimal wiring required by the module.

Acceptance criteria:

- The dashboard module has no write operations.
- It does not add methods to `DatabaseService`.
- It does not call command-service methods.
- Unit tests cover query/cursor validation helpers where applicable.

### Checkpoint 2 — Organization overview [x]

Implement:

```http
GET /dashboard/organizations/:organizationId/overview
```

Scope:

- Organization existence check.
- Database aggregate queries for operation status counts, shelter count, and active activation count.
- Explicit overview response DTO.

Acceptance criteria:

- Unknown organization returns `404`.
- Counts are correct for empty and populated organizations.
- Data from another organization is not included.
- The implementation uses aggregate queries rather than loading all rows into application memory.

### Checkpoint 3 — Cursor-paginated operations list [x]

Implement:

```http
GET /dashboard/organizations/:organizationId/operations
```

Scope:

- Strict query validation for `limit`, `cursor`, and optional `status`.
- Cursor/keyset pagination using `updatedAt DESC, id DESC`.
- Explicit operation-card response DTO.

Acceptance criteria:

- Unknown organization returns `404`.
- Default limit is `25`; maximum is `100`.
- Invalid limit, status, or cursor returns structured `400`.
- The next page does not duplicate items from the previous page.
- The optional status filter returns only operations in that state.
- E2E tests prove stable pagination across multiple pages.

### Checkpoint 4 — Operation map projection [x]

Implement:

```http
GET /dashboard/emergency-operations/:operationId/map
```

Scope:

- Operation summary.
- Current affected-region projection.
- Active shelter activation projection joined to shelters.
- Coordinate filtering and `unmappedActiveShelterCount`.

Acceptance criteria:

- Unknown operation returns `404`.
- Removed affected regions are excluded.
- Deactivated shelter activations are excluded.
- Active shelters from other operations or organizations are excluded.
- Shelters without complete coordinates are omitted and counted.
- The response uses a bounded number of projection queries and has no N+1 behavior.

### Checkpoint 5 — Query review and performance verification

Review the final dashboard query shapes.

Scope:

- Run `EXPLAIN` for overview, operation-list, and map queries against representative test data.
- Add a migration only if query plans demonstrate a justified missing index.
- Candidate indexes, if evidence supports them:
  - `emergency_operations (organization_id, status)`
  - partial active-activation index by `emergency_operation_id`

Acceptance criteria:

- Query plans and indexing decisions are documented.
- No speculative indexes are added.
- Any new migration has focused integration coverage.

### Checkpoint 6 — Iteration completion

Scope:

- Full unit and isolated integration/E2E test suite.
- Read-only code review.
- README examples for dashboard endpoints.
- Update this iteration status only after all verification passes.

Acceptance criteria:

- Build, lint, unit tests, E2E tests, and Drizzle checks pass.
- No unrelated changes remain.
- Dashboard contracts are documented and ready for a future frontend and AI-service iteration.

## Out of scope

- Frontend/dashboard UI
- Map library selection or implementation
- Authentication and authorization
- LangGraph, AI service, RAG, protocol documents, or human approval workflows
- Caching
- PostGIS or geospatial distance/intersection queries
- GeoJSON boundary storage or retrieval
- Viewport/bounding-box map queries
- Marker clustering
- Broad analytics and reporting
- Changes to existing domain write endpoints
