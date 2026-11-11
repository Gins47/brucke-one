# Iteration 009 — Manual Shelter Assignment

**Status:** Planned

**Purpose:** Allow a development administrator to review a pending help request
and manually assign it to an eligible shelter associated with the request’s
emergency operation.

## 1. Goal

Demonstrate one complete operator-led flow using synthetic data:

1. Submit a help request using the existing public API through Postman or curl.
2. Open the emergency operation in the operator dashboard.
3. View its pending help requests.
4. Select a shelter activated for that operation.
5. Reserve enough places for the request’s group.
6. Show the confirmed assignment in the operator dashboard.

A submitted help request is not automatically assigned to a shelter. The
operator decides which shelter is appropriate.

This is a local proof of concept, not a live emergency service.

## 2. Existing foundation

The current application provides:

- public help-request submission with a required idempotency key;
- `PENDING_REVIEW` as the initial request status;
- a protected, operation-scoped help-request queue API;
- emergency operations and historical shelter activations;
- activation availability reports containing operational capacity,
  current occupancy, reserved places, and acceptance status;
- a dashboard operation-detail page with a “People seeking help” placeholder;
- a development ADMIN role with application-wide access.

The existing availability snapshot alone does not identify which help request
owns a reservation. Its existing update path can replace `reservedPlaces`.
This iteration must protect assignment-created reservations from being
overwritten.

## 3. Scope

### Included

- Persist a manual request-to-shelter assignment.
- Provide a protected operator assignment endpoint.
- Reserve places against the shelter activation’s availability.
- Move the request from `PENDING_REVIEW` to `RESERVED`.
- Display pending requests and assigned requests in the operation dashboard.
- Add focused transaction, concurrency, API, and UI tests.
- Document and manually verify the synthetic-data demo.

### Not included

- Public user-facing request form.
- Automatic shelter selection or AI-assisted allocation.
- Address geocoding, route calculation, or suitability scoring.
- Email, SMS, QR codes, or other requester notifications.
- Reservation expiry, cancellation, release, reassignment, or check-in.
- Changing current occupancy as a result of assignment.
- New roles, organization membership, or production authorization.
- BullMQ workers or processing queued help-request events.

## 4. Product and data rules

### Request and shelter eligibility

A new assignment is allowed only when:

- the help request belongs to the route’s emergency operation;
- the help request is `PENDING_REVIEW`;
- the emergency operation is `ACTIVE`;
- the shelter activation belongs to the same operation and is `ACTIVE`;
- an availability report exists;
- the shelter is marked as accepting arrivals;
- reported operational capacity does not exceed physical shelter capacity;
- available places are at least the request’s group size.

A missing availability report is **not reported**, not zero availability.

The operator must review the request’s travel and medical-support information.
Having sufficient capacity does not prove that a shelter can meet a person’s
medical or accessibility needs.

### Capacity accounting

Available places are derived:

```text
available places =
  operational capacity − current occupancy − reserved places
```

On successful assignment:

- increase `reservedPlaces` by the request’s `groupSize`;
- do not change `currentOccupancy`;
- do not change the physical or operational capacity;
- do not claim that people have arrived.

### Repeated assignments

- Repeating the same assignment for the same request and activation returns the
  existing assignment without reserving places again.
- Attempting to assign the same request to a different activation returns
  `409 Conflict`.
- A database uniqueness constraint is the final safeguard against multiple
  assignments for one help request.

### Availability updates

The current availability PUT can replace `reservedPlaces`. Once an activation
has a manual assignment:

- it must reject an update that changes the current `reservedPlaces`;
- it may accept changes to other report fields only when all existing
  capacity constraints continue to hold;
- a stale request that supplies a different reserved count returns
  `409 Conflict` and requires a refresh.

The UI must make the reserved-places field read-only where this rule applies.

For the demo, use a fresh synthetic availability report with
`reservedPlaces = 0`. Existing manually reported reserved places are an
unattributed baseline and must not be assumed to belong to a particular
request.

### Physical capacity

For this PoC, reject decreases to a shelter’s physical capacity through the
shelter API; increases remain allowed. This temporary rule avoids introducing
new capacity inconsistencies while reservation ownership is refined.

Existing inconsistent reports must be corrected before assignment.

### After assignment

For this PoC, if an operation is later completed/cancelled or an activation is
deactivated, retain the assignment and reservation as historical records.

This does **not** guarantee the shelter remains available. A real workflow
requires an explicit closure, cancellation, release, and reallocation policy.

## 5. Proposed API

```http
POST /emergency-operations/:operationId/help-requests/:requestId/assignment
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "shelterActivationId": "<uuid>"
}
```

The endpoint is protected by the existing development ADMIN guard.

A successful response returns the persisted assignment and enough shelter
identity for the operator UI. Define the exact response DTO during the
backend checkpoint using existing project conventions.

Expected outcomes:

- `201` or the project’s agreed success convention: assignment created.
- Same request and same activation: return the existing assignment without
  reserving again.
- `404`: operation, request, or activation does not exist within the expected
  route scope.
- `409`: invalid state, another assignment exists, availability is stale,
  the shelter is not accepting arrivals, or insufficient places remain.
- `400`: malformed UUID or request body.
- `401` / `403`: existing authentication/authorization behavior.

The implementation must document the exact response codes chosen for a
same-assignment replay.

## 6. Transaction and integrity

A new assignment must use one short PostgreSQL transaction:

1. Lock the help request and check whether an assignment already exists.
2. Lock the shelter activation, emergency operation, physical shelter, and
   availability row in an order compatible with existing write paths.
3. Recheck eligibility and available places while holding the relevant locks.
4. Create the assignment.
5. Increment `reservedPlaces`.
6. Change the request status to `RESERVED`.
7. Commit all changes together.

Inspect all affected writers before finalizing lock order. Avoid external
network calls inside the transaction.

Database constraints should enforce:

- one assignment per help request;
- a positive reserved group size;
- valid, restrictive references to the request and activation;
- the request and activation belong to the same emergency operation.

A retry returning a previously committed assignment is a historical read; it
does not create another reservation, even if the operation has since closed.

## 7. Checkpoints

### Checkpoint 1 — Assignment schema and migration

- Add the smallest assignment schema supporting request, operation,
  activation, reserved group size, assigning ADMIN user, and creation time.
- Add uniqueness, foreign keys, and operation-consistency constraints.
- Generate and review an additive migration.
- Add focused PostgreSQL constraint coverage where it protects a meaningful
  invariant.

**Acceptance:** The database can persist one operation-consistent assignment
per help request. No assignment API or UI is added yet.

**Implementation record (2026-11-11):** Implemented and verified; review and
acceptance pending. The additive Drizzle migration creates the assignment
table, restrictive references, a positive group-size check, and one assignment
per request. Composite references to the request and activation enforce a
shared operation. No development database migration was applied.

The table is named `help_request_shelter_assignments` to represent assignments
independently of how they are made. This iteration supports manual assignments
only and requires `assigned_by_user_id` for the authenticated ADMIN. Future
automated assignment requires a deliberate actor-model and schema change; no
system user or automation-specific fields are introduced here. See
[decision 0012](../decisions/0012-assignment-identity-and-actors.md).

Verification with Node 24.22.0: isolated PostgreSQL constraint tests (5 passed),
full isolated API E2E suite (23 suites, 158 tests passed), API build,
non-mutating ESLint, Drizzle check, and `git diff --check`. Checkpoint 2 owns
the API, transaction, availability protection, and capacity guard.
After the table rename, the isolated constraint tests, build, non-mutating
ESLint, Drizzle check, and diff check passed again; the full E2E suite was not
rerun after the rename.

### Checkpoint 2 — Protected assignment API

- Add the protected endpoint and explicit request/response DTOs.
- Implement eligibility checks and the atomic assignment transaction.
- Protect assignment-created `reservedPlaces` from availability PUT updates.
- Add the temporary physical-capacity decrease guard.
- Extend the protected queue response only as needed to show the assignment
  for a `RESERVED` request.
- Preserve public intake and idempotency behavior.

**Acceptance:** An authorized ADMIN can assign a pending request to a valid
activation without double-assignment or over-reservation.

### Checkpoint 3 — Operator dashboard

In the emergency operation’s “People seeking help” tab:

- load pending requests using the existing paginated queue API;
- show the information an operator needs for review;
- allow selection of an eligible active shelter, including shelters without
  map coordinates;
- display reported availability and submit the assignment;
- show the server-confirmed result;
- offer a `RESERVED` view so results remain visible after refresh;
- handle loading, empty, stale-capacity, conflict, and network-error states;
- preserve existing stale-response protection when changing organization or
  operation.

The UI’s displayed capacity is informational. The API remains authoritative
when the operator submits.

**Acceptance:** An operator can perform and confirm a manual assignment
through the dashboard using synthetic data.

### Checkpoint 4 — Final verification and demo documentation

- Verify the full synthetic flow from API submission to dashboard assignment.
- Run relevant focused tests, API/web tests, build, lint, and Drizzle check.
- Document local setup, example request, expected result, and known limitations.
- Update project status and the iteration index with actual verification
  results.

**Acceptance:** The demo can be reproduced without presenting it as a live
emergency service or claiming that a notification was delivered.

## 8. Focused test expectations

Prefer a small number of clear tests that protect business behavior.

Backend integration tests must cover:

1. Successful assignment persists one assignment, increments reservations,
   leaves occupancy unchanged, and changes the request status atomically.
2. Two different requests competing for the last available places cannot both
   succeed.
3. Repeating the same assignment does not reserve twice; a different
   activation for the same request conflicts.
4. A stale availability update cannot erase an assignment-created reservation.
5. Invalid operation/activation state, missing or insufficient availability,
   and unauthorized access are rejected.

Use compact parameterized tests where appropriate. Test the physical-capacity
guard and transaction rollback. Add a focused race test for assignment versus
parent closure if needed to validate the selected locking approach; otherwise,
report that race as unverified rather than claiming it is covered.

Frontend tests should cover the essential pending → assignment flow and a
capacity conflict, plus result visibility after refresh where practical.

## 9. Limitations

- Development ADMIN access is application-wide, not tenant isolation.
- The short-reference public flow is only for controlled synthetic data.
- Existing manually reported reservations are not linked to individual
  requests.
- This slice has no release, reassignment, expiry, check-in, or notification.
- Assignment does not establish medical suitability or safe travel.
- BullMQ publication does not mean the request was assigned or processed by
  a worker.
