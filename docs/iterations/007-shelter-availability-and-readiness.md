# Iteration 007 — Shelter Availability and Operational Readiness

**Status:** Complete
**Prerequisites:** Iterations 001–006 accepted; shelters, emergency operations, shelter activations, dashboard read APIs, and development authentication are available.

## Goal

Enable an operator to report and view whether an active shelter can currently receive more people during a specific emergency operation.

The iteration establishes reliable, operation-specific availability facts: operational capacity, current occupancy, confirmed reserved places, acceptance of arrivals, and the resulting available places. It does not introduce individual people, resources or stock, supplier orders, dispatch, AI, or automated matching.

## Scope and domain language

`shelters.capacity` remains the shelter's stable physical maximum capacity.

For each active shelter activation, an operator may report an operational availability record:

| Term | Meaning |
| --- | --- |
| Physical capacity | The shelter's maximum capacity stored on `shelters`. |
| Operational capacity | The number of places safely usable during this operation. It may be lower than physical capacity. |
| Current occupancy | People currently at the shelter. |
| Reserved places | Confirmed assignments for people who have not yet arrived. |
| Available places | A derived value: operational capacity − current occupancy − reserved places. |
| Accepting arrivals | An operator-controlled decision whether new assignments are currently allowed. |
| Not reported | No availability record exists. It must never be presented as zero occupancy or available capacity. |

`available_places` is calculated in application read models and responses. It is not stored as a database column.

An availability record belongs to one `shelter_activation`, preserving the historical context in which it was reported. The activation already identifies the shelter, emergency operation, and organization.

## Proposed schema

Create `shelter_activation_availability` with one record at most for each shelter activation.

| Field | Rule |
| --- | --- |
| `shelter_activation_id` | UUID primary key and restrictive foreign key to `shelter_activations.id`; immutable. |
| `operational_capacity` | Required integer, `>= 0`; cannot exceed the parent shelter's physical capacity. |
| `current_occupancy` | Required integer, `>= 0`. |
| `reserved_places` | Required integer, `>= 0`. |
| `accepting_arrivals` | Required boolean. |
| `availability_note` | Optional trimmed text explaining a restriction or relevant situation. |
| `reported_at` | Required timezone-aware timestamp set by the server whenever a report is created or updated. |
| `created_at`, `updated_at` | Required timezone-aware audit timestamps. |

Database constraints:

```text
operational_capacity >= 0
current_occupancy >= 0
reserved_places >= 0
current_occupancy + reserved_places <= operational_capacity
```

The cross-table rule `operational_capacity <= shelters.capacity` cannot be expressed as a normal PostgreSQL `CHECK` constraint. The service must load and lock the parent activation and shelter in the availability transaction, verify the rule, then write the record.

No availability record is inserted automatically with zero values when an activation is created. An explicit report is required, so missing data remains distinguishable from an empty shelter.

## Lifecycle and concurrency

- Create or update availability only when the shelter activation is `ACTIVE` and its emergency operation is `ACTIVE`.
- Availability reports are immutable after the activation is deactivated or the operation becomes terminal. Existing reports remain visible for history.
- Create and update commands run in a short transaction and lock the parent activation while checking both parent states and writing availability. The activation deactivation and operation-terminal commands must use a compatible lock or conditional strategy, so a stale availability command cannot succeed after a parent transition.
- Updating an existing availability row must lock that row before calculating and validating the new values. This prevents concurrent updates from over-allocating capacity.
- No person assignment, reservation creation, automatic availability reduction, occupancy event history, or bulk update is introduced in this iteration.

## API conventions

All routes remain protected by the current development ADMIN boundary. Use strict Zod schemas, `ZodValidationPipe`, UUID route validation, explicit response DTOs, and the established `400`/`404`/`409` conventions.

| Endpoint | Purpose |
| --- | --- |
| `GET /shelter-activations/:activationId/availability` | Return the current reported availability or a clear not-reported response. |
| `PUT /shelter-activations/:activationId/availability` | Create the first report or replace all reportable fields for an active activation. |

Use `PUT` because availability is a single current snapshot and the complete set of reportable values is supplied together. The request body includes `operationalCapacity`, `currentOccupancy`, `reservedPlaces`, `acceptingArrivals`, and optional `availabilityNote`.

The successful response includes the reported values plus derived `availablePlaces`, shelter ID, operation ID, organization ID, and timestamps. It must not imply that `availablePlaces` represents a person-level assignment record.

`GET` returns `404` for an unknown activation. For a known activation without a report, it returns a documented response with `availability: null` rather than inventing zero values. `PUT` returns `409` when the activation or operation is not active, a concurrent parent transition wins, or the requested operational capacity exceeds the shelter capacity. Validation errors return the project-standard structured `400` response.

## Dashboard read models

Extend the existing operation read model so the selected operation can display availability per active shelter and truthful totals. The API must expose the active `shelterActivationId` with its shelter projection; this is a narrow read-model addition needed for the Shelters tab and availability API.

For every active shelter, return:

- availability report status (`REPORTED` or `NOT_REPORTED`);
- reported operational capacity, occupancy, reserved places, available places, acceptance flag, note, and `reportedAt` when present;
- existing map coordinates and shelter details where available.

The operation-level summary must include explicit coverage counts:

- total active shelters;
- mapped and unmapped shelters;
- availability-reported and availability-not-reported shelters.

Capacity totals are returned only for availability-reported shelters and are labelled accordingly. The UI must not display them as a complete operation total when one or more active shelters have not reported availability.

## UI scope

### Shelter availability view

- Add an availability section in the active-shelter context, using actual API data.
- Show `Not reported yet` when no record exists and provide a report/update form only for an active activation with an active operation.
- Show physical capacity separately from operational capacity, current occupancy, reserved places, derived available places, accepting-arrivals status, note, and report time.
- Validate input before submission and show API conflict responses clearly without exposing internal details.

### Emergency operation dashboard

- Add summary cards or equivalent summary content for reported operational capacity, current occupancy, reserved places, available places, shelters accepting arrivals, and report coverage.
- Add the fields to the Shelters tab/table and shelter-map details where space permits.
- Make incomplete coverage obvious, for example: `Availability reported for 2 of 3 active shelters`.
- Do not imply that an accepting shelter is automatically safe, that availability is real-time, or that a missing report means zero occupancy.

Existing loading, error, authentication-expiry, selected-organization, responsiveness, and stale-response protections apply to all new reads and writes.

## Checkpoints

### 1. Schema, migration, and constraints

- Add the availability schema, export it, generate one reviewed Drizzle migration, and inspect the generated SQL.
- Add focused isolated-PostgreSQL tests for the one-to-one foreign key, numeric constraints, occupancy-plus-reservations constraint, and restrictive deletion behavior.
- Do not modify existing activation or operation lifecycle behavior unless the compatible concurrency strategy requires a narrowly documented change.

**Acceptance:** The migration matches this document; missing availability remains possible; invalid values cannot be persisted.

**Status:** Complete

**Implementation record:**

- `shelter_activation_availability` uses `shelter_activation_id` as both its
  primary key and restrictive foreign key. It stores no duplicated shelter,
  operation, or organization identifiers and does not create rows
  automatically.
- The reviewed migration adds the required numeric and total-capacity checks.
  Cross-table physical-capacity validation remains deferred to Checkpoint 2.
- Focused isolated PostgreSQL tests cover the one-to-one key, missing
  activation, every negative numeric value, total-capacity overflow, and
  restrictive activation deletion. The migration was applied only to the
  disposable test database, which was removed after the suite.

### 2. Availability API and concurrency rules

- Implement the availability module, strict DTOs, explicit responses, `GET`, and `PUT`.
- Enforce active-parent state, physical-capacity limit, derived available places, and the agreed transaction/locking behavior.
- Add focused service and isolated PostgreSQL HTTP tests for valid creation/update, unreported availability, invalid values, inactive/terminal parents, capacity limit, and a concurrent update or parent-transition path.

**Acceptance:** The API reports truthful availability, does not over-allocate under concurrent writes, and returns established error contracts.

**Status:** Complete

**Implementation record:**

- `GET /shelter-activations/:activationId/availability` returns either the
  reported snapshot with a derived `availablePlaces` value or
  `{ shelterActivationId, availability: null }` for an existing activation
  that has not reported availability. Historical reports remain readable.
- `PUT /shelter-activations/:activationId/availability` replaces the complete
  report for active parents. It validates a complete non-negative snapshot,
  enforces the physical shelter-capacity limit, sets report/audit timestamps
  server-side, and never stores `availablePlaces`.
- The write transaction locks the activation, its emergency operation, its
  shelter, and an existing availability row in that order. This serializes the
  report with activation deactivation and operation terminal-state updates;
  a parent transition that wins first is observed as a `409` conflict.
- Focused service and isolated PostgreSQL HTTP tests cover creation,
  replacement, not-reported history, strict validation, capacity conflicts,
  inactive/terminal parents, derived values, and concurrent-state conflict
  handling. The isolated test database is migrated and removed by its normal
  lifecycle.

### 3. Operation dashboard read model

- Extend the existing operation map/read DTO with `shelterActivationId`, per-shelter availability, and explicit coverage metadata.
- Add focused API tests for reported and unreported shelters, mapped and unmapped shelters, and partial totals.
- Preserve existing response behavior for fields outside this iteration.

**Acceptance:** Clients can render each active shelter's availability and know when aggregate data is incomplete.

**Status:** Complete

**Implementation record:**

- The existing operation-map endpoint now returns `activeShelterAvailability`
  for every active activation. Each row includes the activation ID, shelter
  projection, nullable coordinates, and either a reported availability object
  or `null` when no report exists.
- `activeShelters` remains the existing mapped-only list for map consumers and
  now includes the matching activation ID and availability. Explicit
  `mappedActiveShelterCount` and `unmappedActiveShelterCount` retain map
  coverage independently from availability coverage.
- `availabilitySummary` is derived from the same all-active shelter rows.
  Its capacity totals are therefore explicitly reported-only totals, and its
  reported/not-reported counts describe coverage without treating a missing
  report as zero values.
- The shelter read query uses one left join to availability and stable
  `shelter_code`, then shelter ID ordering. Focused isolated PostgreSQL tests
  cover reported and unreported data, map/availability coverage independence,
  deactivated-activation exclusion, and ordering.

### 4. Shelter and dashboard UI

- Add the organization-scoped read models `GET /dashboard/organizations/:organizationId/shelters`
  and `GET /dashboard/organizations/:organizationId/shelters/:shelterId`. They expose
  stable shelter details and only the current active activation, its operation, and its
  availability when present; they do not expose activation history. The list remains
  unpaginated only for the small development dataset.
- Replace the selected-organization shelter page's client-side filtering of the global
  shelter API with the organization dashboard read model. Add `/shelters/:shelterId`
  for the shelter detail and route shelter names there from the operation Shelters tab.
- Implement availability display and the complete report/update flow only in the active
  shelter detail context. Preserve explicit reported, not-reported, and no-active-operation
  states, and use actual API results after an update.
- Update the operation Shelters tab with operational capacity, current occupancy,
  available places, and availability status. Reserved places remain on the shelter detail.
- Add focused API and frontend tests for scoped data, reported/not-reported and inactive
  states, navigation, update conflicts, and stale session/selection responses.

**Acceptance:** The UI never invents availability values and accurately distinguishes physical capacity, operational capacity, occupancy, reservations, and available places.

**Status:** Complete

**Implementation record:**

- `GET /dashboard/organizations/:organizationId/shelters` and
  `GET /dashboard/organizations/:organizationId/shelters/:shelterId` use one
  joined shelter read with the current active activation, operation, and
  optional availability report. A shelter that belongs to another organization
  returns `404`; no activation history is returned.
- The selected-organization shelter list is deliberately unpaginated for the
  small development dataset. It is a dashboard read convenience and does not
  replace production organization authorization.
- `/shelters` displays the selected organization’s current shelter contexts.
  `/shelters/:shelterId` displays stable shelter facts, its active operation
  when present, and reported availability. The form submits a complete report
  through the existing availability `PUT` endpoint and displays the
  server-confirmed values.
- The operation Shelters tab uses all active shelter rows, including unmapped
  shelters, and links each shelter to its detail page. It labels missing
  availability explicitly and keeps reserved places on the shelter detail.
- The selected-organization shelter page now presents reported-only readiness
  totals, availability coverage, follow-up items, and an accessible quick
  view. Missing reports remain unknown values throughout the UI. Its map uses
  only real shelter context: accepting, not-accepting, not-reported, and
  inactive shelters are labelled distinctly; it never fabricates activation
  identifiers or availability values. The responsive shelter list remains
  usable when the map is unavailable.

### 5. Final verification and documentation

- Review the schema, migration, API, read model, UI, lifecycle/concurrency behavior, and documentation against this iteration.
- Run the relevant isolated database tests, API tests, frontend tests, build, lint, Drizzle check, and `git diff --check`.
- Update README and iteration records with actual API contracts, calculation semantics, data freshness limitations, and deferred work.

**Acceptance:** The final documentation records only verified behavior and remaining limitations.

**Status:** Complete

**Final acceptance summary:**

- A shelter activation has at most one availability snapshot. PostgreSQL
  rejects missing activation references, negative values, and snapshots where
  occupancy plus reservations exceeds operational capacity; deleting an
  activation with availability is restricted.
- `GET /shelter-activations/:activationId/availability` returns either a
  reported snapshot or `{ shelterActivationId, availability: null }`. `PUT`
  replaces the complete snapshot only while the activation and its operation
  are active. `availablePlaces` is always derived as operational capacity
  minus current occupancy minus reserved places and is never persisted.
- Dashboard read models and the selected-organization shelter UI distinguish
  reported, not-reported, and inactive contexts. Read-model capacity totals
  include reported availability only, so they are coverage-limited rather
  than complete operation totals. Map markers, the list, quick view, and
  shelter detail use the same real status data.
- Verification on Node 24.22.0 passed: availability service tests (5), API
  unit tests (58), isolated PostgreSQL integration tests (18 suites, 111
  tests), frontend tests (13 files, 33 tests), API and web builds, API and web
  lint, Drizzle schema validation, and `git diff --check`.

**Verified deferred work:** People and registrations, reservations and
automatic matching, resources and inventory, suppliers and dispatch, AI and
approvals, weather/hazard integration, production tenant authorization,
persistent sessions, notifications, analytics, and production-scale
pagination/indexing remain out of scope.

## Explicitly deferred

- Individual people, registrations, person assignment, pickup, routes, or personally identifiable information.
- Resource catalogues, food/medicine stock, inventory movements, consumption estimates, suppliers, purchase orders, dispatch, or fulfilment.
- AI agents, recommendations, automated matching, human approvals, and agent-initiated actions.
- Weather/hazard integration, safety assessment, and claims that a shelter is safe.
- Production tenant authorization, persistent browser sessions, refresh-token rotation, notifications, analytics, and production-scale pagination/indexing.
