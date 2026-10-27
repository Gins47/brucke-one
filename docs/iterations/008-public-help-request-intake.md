# Iteration 008 — Public Help-Request Intake

**Status:** Planned  
**Prerequisites:** Iterations 001–007 accepted; emergency operations, development authentication, organization-scoped dashboards, and shelter availability are available.

## Goal

Let an affected person submit a minimal help request without logging in, and let authorized operators see the resulting requests in a protected queue.

This iteration establishes an auditable intake record only. It does **not** match a person to a shelter, reserve capacity, create a QR code, send email, perform geocoding, or use AI.

```text
Public country page → active operation selection → help request
→ PENDING_REVIEW → protected operator queue
```

## Scope and product decisions

- The public entry route is `/request-help/:countryCode`, for example `/request-help/de`.
- URL country codes are lowercase ISO 3166-1 alpha-2 values; the API normalizes and validates them as uppercase values such as `DE`.
- The public page lists only the relevant country's active emergency operations and exposes only safe, minimal operation details.
- If exactly one operation is active, the UI may preselect it. If more than one is active, the person selects one explicitly.
- A submitted request always starts as `PENDING_REVIEW`.
- The requester provides their name, phone number, group size, location description, independent-travel answer, and medical-support-needed answer. Email is optional.
- When an email is supplied, one normalized email can have only one request for the same emergency operation. The same email can request help in another operation.
- The public UI does not require login, email verification, a public status lookup, or a public request-edit flow.
- The public confirmation must state that receipt of a request does not confirm a shelter placement.
- Existing protected APIs remain protected. Only the explicitly documented public endpoints bypass the development ADMIN guard.

## Domain model

Create a `help_requests` table.

| Field | Rule |
| --- | --- |
| `id` | UUID primary key. |
| `emergency_operation_id` | Required restrictive foreign key to `emergency_operations.id`; immutable after creation. |
| `public_reference` | Required opaque, unique server-generated reference. It is not a credential and is not used for public lookup in this iteration. |
| `requester_name` | Required trimmed text. |
| `requester_phone` | Required trimmed text. No country-specific phone validation in this iteration. |
| `requester_email` | Optional normalized email text: lowercase and trimmed when present. |
| `group_size` | Required positive integer. |
| `location_description` | Required trimmed text; accepts an address, postcode, locality, or landmark. No coordinates are required yet. |
| `can_travel_independently` | Required boolean. |
| `medical_support_needed` | Required boolean. |
| `status` | Required `help_request_status`, created as `PENDING_REVIEW`. No transition command is introduced in this iteration. |
| `created_at`, `updated_at` | Required timezone-aware audit timestamps. |

Define `help_request_status` with the planned lifecycle values:

```text
PENDING_REVIEW
MATCHING
OPERATOR_REVIEW_REQUIRED
RESERVED
PARTIALLY_ARRIVED
ARRIVED
CANCELLED
EXPIRED
```

Only `PENDING_REVIEW` is created or acted on in this iteration. The remaining values document the stable domain vocabulary for later matching, reservation, and arrival iterations; they do not authorize those features now.

### Database constraints and indexes

```text
group_size > 0
requester_email IS NULL OR requester_email = lower(btrim(requester_email))
UNIQUE (public_reference)
UNIQUE (emergency_operation_id, requester_email)
  WHERE requester_email IS NOT NULL
```

Add an index that supports the later operator queue, scoped by operation and ordered by creation time. Preserve the operation's historical integrity with `ON DELETE RESTRICT`.

Do not add a `shelter_id`, `shelter_activation_id`, `reservation_id`, latitude/longitude, AI summary, QR token, assignment decision, or person-registration fields.

## API conventions

Use strict Zod schemas, the project-owned validation pipe, UUID route validation where applicable, explicit response DTOs, and established error conventions. Public endpoints must have small, purpose-specific DTOs and must not expose internal operational fields.

### Public endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /public/countries/:countryCode/emergency-operations` | Return minimal details for active operations in the supplied country only. |
| `POST /public/countries/:countryCode/help-requests` | Validate and submit one request for an active operation in the supplied country. |

The public operation list includes only `id`, operation code, name, country code, affected regions, and active status. It does not expose shelters, capacity, staffing, notes, internal identifiers beyond the operation ID needed for the form, or administrative contact data.

For creation, the service must verify in one controlled write path that:

1. the requested operation exists;
2. it is `ACTIVE`;
3. it belongs to the route country;
4. a duplicate normalized email does not create another request for that operation.

Apply an explicit, documented basic rate limit and request-size limit to the public write endpoint. Do not introduce CAPTCHA, email delivery, or phone verification in this iteration.

The public response is deliberately generic and does not disclose whether a supplied email already has a request. It confirms only that the request was received for follow-up. The public reference is persisted but not treated as a public read credential.

### Protected operator endpoint

| Endpoint | Purpose |
| --- | --- |
| `GET /emergency-operations/:operationId/help-requests` | Return a paginated, stable, protected list of requests for an operation. |

The protected queue is scoped through the operation's organization. It initially lists `PENDING_REVIEW` requests with the requester's minimum operational contact details and submission time. It must not expose cross-organization records.

## UI scope

### Public help-request flow

- Build `/request-help/[countryCode]` as a mobile-first, no-login page separate from the operator dashboard shell.
- Show a country-specific operation selector only when more than one active operation is available; preselect exactly one operation when applicable.
- Collect the fields specified above with clear, plain-language labels.
- Include a short emergency disclaimer: immediate danger requires contacting local emergency services.
- On success, show a generic confirmation: `Your request has been received. A shelter placement has not yet been confirmed.`
- Provide clear loading, validation, duplicate-safe confirmation, unavailable-operation, and service-error states.
- Do not show operational capacity, shelter recommendations, maps, QR codes, or a request-status screen.

### Operator queue

- Add a protected, organization-aware request-queue view reached from the relevant active emergency operation.
- Show request reference, requester name, contact method, group size, location description, independent-travel answer, medical-support-needed answer, status, and submitted time.
- Show an explicit empty state when no requests are pending review.
- No approve, reject, assignment, reservation, or status-transition actions are added in this iteration.

## Checkpoints

### 1. Schema, migration, and constraints

- Add the help-request schema, exports, one reviewed Drizzle migration, and snapshot.
- Add focused isolated-PostgreSQL tests for required fields, positive group size, operation foreign key restriction, email normalization, partial uniqueness per operation, nullable email behavior, public-reference uniqueness, and default `PENDING_REVIEW` status.
- Do not add API, authentication, public routes, UI, matching, reservation, geocoding, email, QR, or AI changes.

**Acceptance:** An intake record is structurally valid, email duplicates cannot be created within one operation, and no assignment data exists.

**Status:** Complete

**Implementation record:**

- `help_requests` has a UUID primary key, a restrictive immutable operation
  reference, opaque unique public reference, minimum requester contact and
  context fields, and timezone-aware audit timestamps. It stores no shelter,
  activation, reservation, assignment, coordinate, AI, or notification data.
- `help_request_status` records the agreed lifecycle vocabulary. New rows
  default to `PENDING_REVIEW`; no transition behaviour is implemented.
- PostgreSQL enforces positive group size, normalized optional email text,
  unique public references, and per-operation email uniqueness only when an
  email is present. The operation/creation-time index supports a later
  operation queue without adding queue behaviour now.
- Focused isolated PostgreSQL tests verify persistence and the default status,
  both non-positive group-size cases, normalization, partial uniqueness,
  nullable-email behaviour, public-reference uniqueness, unknown operations,
  and restrictive operation deletion. The migration was applied only to the
  disposable test database, which was removed after the test run.

### 2. Public intake API

- Add the two narrowly public endpoints and the minimal public-route guard exception.
- Validate active operation and country consistency.
- Add focused API tests for successful submission, inactive/unknown/wrong-country operations, malformed input, normalized duplicate email, generic duplicate response, rate limit behaviour, and assurance that existing protected endpoints remain protected.

**Acceptance:** A person can submit a valid country-scoped request without login, while public endpoints disclose only intentional information.

### 3. Protected operator queue API

- Add the operation-scoped paginated queue read model.
- Add focused API and isolated PostgreSQL tests for stable ordering, pagination, operation/organization scoping, empty state, and protected access.

**Acceptance:** An authorized operator can see only the pending requests for their operation.

### 4. Public and operator UI

- Implement the public mobile-first request form and confirmation state.
- Implement the protected operator queue in the operation workflow.
- Add focused frontend tests for one/multiple/no active operations, validation, generic success/duplicate handling, session separation, queue rendering, and responsive behaviour.

**Acceptance:** A public user can request help without login; an operator can see the submitted request; neither UI implies placement is confirmed.

### 5. Final verification and documentation

- Review schema, migration, public exposure, API contracts, queue scope, UI states, and documentation against this iteration.
- Run relevant isolated database tests, API tests, frontend tests, build, lint, Drizzle check, and `git diff --check`.
- Record verified public-endpoint limits, personal-data handling, and deferred matching/reservation work accurately.

**Acceptance:** Intake is safe, narrow, tested, and documented; no shelter capacity or assignment is changed by a request.

## Explicitly deferred

- AI-assisted conversation, MCP tools, OpenUI, translation, voice, and model-generated summaries.
- Address geocoding, coordinates, routing, maps, and shelter recommendation.
- Shelter matching, capacity reservations, QR codes, assignment decisions, arrivals, and person registration.
- Email confirmation, email verification, SMS, telephone, WhatsApp, notifications, and public request lookup/editing.
- Operator review actions, status transitions, role expansion, production tenant authorization, and production-grade abuse prevention.
