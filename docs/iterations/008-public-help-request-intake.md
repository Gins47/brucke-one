# Iteration 008 — Public Help-Request Intake

**Status:** In progress — backend completion planned
**Prerequisites:** Iterations 001–007 accepted; emergency operations, development authentication, organization-scoped dashboards, and shelter availability are available.

## Goal

Finish the help-request backend: accept a minimal public request, make it
available through a protected operator queue API, and establish the durable
asynchronous handoff boundary for later processing.

This iteration establishes an auditable intake record only. It does **not** match a person to a shelter, reserve capacity, create a QR code, send email, perform geocoding, or use AI.

```text
Public operation-list API → help-request API → PENDING_REVIEW
→ protected operator queue API
```

## Scope and product decisions

- Public API country-code paths use lowercase ISO 3166-1 alpha-2 values, for
  example `/public/countries/de/help-requests`; the API normalizes and
  validates them as uppercase values such as `DE`.
- The public operation-list API exposes only safe, minimal details for active
  operations in the selected country.
- A submitted request always starts as `PENDING_REVIEW`.
- The requester provides their name, phone number, group size, location description, independent-travel answer, and medical-support-needed answer. Email is optional.
- When an email is supplied, one normalized email can have only one request for the same emergency operation. The same email can request help in another operation.
- A public and operator UI is deferred to the planned Iteration 009. Iteration
  008 defines backend contracts only.
- The current public acknowledgement states that receipt does not confirm a
  shelter placement.
- Existing protected APIs remain protected. Only the explicitly documented public endpoints bypass the development ADMIN guard.

## Domain model

Create a `help_requests` table.

| Field                      | Rule                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | UUID primary key.                                                                                                               |
| `emergency_operation_id`   | Required restrictive foreign key to `emergency_operations.id`; immutable after creation.                                        |
| `public_reference`         | Required opaque, unique server-generated reference. It is not a credential and is not used for public lookup in this iteration. |
| `short_reference`          | Nullable unique five-character uppercase alphanumeric public identifier. Existing pre-Checkpoint-5 rows remain null; new public submissions receive one. |
| `requester_name`           | Required trimmed text.                                                                                                          |
| `requester_phone`          | Required trimmed text. No country-specific phone validation in this iteration.                                                  |
| `requester_email`          | Optional normalized email text: lowercase and trimmed when present.                                                             |
| `group_size`               | Required positive integer.                                                                                                      |
| `location_description`     | Required trimmed text; accepts an address, postcode, locality, or landmark. No coordinates are required yet.                    |
| `can_travel_independently` | Required boolean.                                                                                                               |
| `medical_support_needed`   | Required boolean.                                                                                                               |
| `status`                   | Required `help_request_status`, created as `PENDING_REVIEW`. No transition command is introduced in this iteration.             |
| `created_at`, `updated_at` | Required timezone-aware audit timestamps.                                                                                       |

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
UNIQUE (short_reference)
short_reference IS NULL OR short_reference ~ '^[A-Z0-9]{5}$'
UNIQUE (emergency_operation_id, requester_email)
  WHERE requester_email IS NOT NULL
```

Add an index that supports the later operator queue, scoped by operation and ordered by creation time. Preserve the operation's historical integrity with `ON DELETE RESTRICT`.

Do not add a `shelter_id`, `shelter_activation_id`, `reservation_id`, latitude/longitude, AI summary, QR token, assignment decision, or person-registration fields.

## API conventions

Use strict Zod schemas, the project-owned validation pipe, UUID route validation where applicable, explicit response DTOs, and established error conventions. Public endpoints must have small, purpose-specific DTOs and must not expose internal operational fields.

### Public endpoints

| Endpoint                                                  | Purpose                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /public/countries/:countryCode/emergency-operations` | Return minimal details for active operations in the supplied country only.       |
| `POST /public/countries/:countryCode/help-requests`       | Validate and submit one request for an active operation in the supplied country. |

The public operation list includes only `id`, operation code, name, country code, affected regions, and active status. It does not expose shelters, capacity, staffing, notes, internal identifiers beyond the operation ID needed for the form, or administrative contact data.

For creation, the service must verify in one controlled write path that:

1. the requested operation exists;
2. it is `ACTIVE`;
3. it belongs to the route country;
4. a duplicate normalized email does not create another request for that operation.

Before live use, the public write endpoint requires explicit rate limiting and
request-size limits. This synthetic-data PoC does not add an in-memory limiter,
CAPTCHA, email delivery, or phone verification.

The persisted opaque `public_reference` is not a public read credential. From
Checkpoint 5, a genuinely new request also returns a short public identifier;
a different-key duplicate email acknowledgement intentionally omits it. This
controlled synthetic-data PoC therefore has the privacy limitation recorded in
Checkpoint 5 and is not a production non-enumerating contract.

### Protected operator endpoint

| Endpoint                                               | Purpose                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `GET /emergency-operations/:operationId/help-requests` | Return a paginated, stable, protected list of requests for an operation. |

The protected queue is scoped through the operation's organization. It initially lists `PENDING_REVIEW` requests with the requester's minimum operational contact details and submission time. It must not expose cross-organization records.

## UI boundary

Public Next.js intake and protected operator-queue views are deliberately out
of scope for Iteration 008. They are planned for a separate Iteration 009 and
must consume the completed backend contracts without extending matching,
reservation, or status-transition behaviour.

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

**Status:** Complete

**Implementation record:**

- `GET /public/countries/:countryCode/emergency-operations` is explicitly
  public. It normalizes a two-letter country code, returns only active
  operations in a deterministic operation-code/ID order, and exposes only
  the operation ID, code, name, country code, and current affected regions.
- `POST /public/countries/:countryCode/help-requests` is explicitly public
  and uses a strict request schema. It normalizes an optional email, locks and
  validates the selected active operation for the route country, and creates a
  `PENDING_REVIEW` request with a 144-bit opaque server-generated reference.
  Missing, inactive, and country-mismatched operations all return the same
  public-safe `404 Emergency operation not found` response.
- At Checkpoint 2, a new request and a duplicate normalized email both
  returned `201` with a fresh ephemeral `acknowledgementReference`,
  `PENDING_REVIEW`, a current `acknowledgedAt` timestamp, and `Your request
has been received. Emergency staff will review it.` That acknowledgement
  reference was not persisted then. It is never a public lookup credential or
  the help request's internal persisted `publicReference`, which remains
  private to later controlled workflows. From Checkpoint 4A, the complete
  acknowledgement response is stored in `help_request_idempotency` only to
  replay a retry with the same `Idempotency-Key`; it cannot be used to look up
  a help request or reveal whether an email was previously submitted. A
  duplicate does not read, create, or modify the existing request.
- Focused service and isolated PostgreSQL HTTP tests cover public listing,
  request validation, country and lifecycle checks, duplicate-safe
  acknowledgement, and continued protection of existing API routes.
- No rate-limiting facility was already established in this stateless API, so
  the iteration adds neither an in-memory limiter nor a dependency. Basic
  rate limiting and production-grade abuse prevention remain deferred.

### 3. Protected operator queue API

- Add the operation-scoped paginated queue read model.
- Add focused API and isolated PostgreSQL tests for stable ordering, pagination, operation/organization scoping, empty state, and protected access.

**Acceptance:** An authorized operator can see only the pending requests for their operation.

**Status:** Complete

**Implementation record:**

- `GET /emergency-operations/:operationId/help-requests` is protected by the
  existing JWT and current ADMIN database-assignment guard. It returns `404`
  when the selected operation does not exist and never exposes an unscoped
  organization-wide queue.
- The queue defaults to `PENDING_REVIEW`. A strict optional `status` query
  accepts only the established `help_request_status` values. It returns the
  minimum operator triage fields, ordered by `createdAt DESC, id DESC`, with
  an opaque cursor encoding both values. The existing
  `(emergency_operation_id, created_at)` index scopes the query; no index or
  migration was added.
- Current ADMIN access is application-wide, so the selected operation is the
  queue boundary but there is no organization-membership check yet. Finer
  organization-scoped roles and access rules remain deferred to Iteration 011.
- Focused isolated PostgreSQL HTTP tests cover protected access, operation
  scoping, empty results, known-status filtering, tied-timestamp pagination,
  validation failures, and missing operations.
- The queue is read-only. Assignment, shelter matching, reservations, status
  transitions, geocoding, QR lookup, and notifications remain deferred.

### 4. Idempotent intake and durable BullMQ handoff

Make public help-request submission safe against browser retries, network
timeouts, and concurrent duplicate submissions, while creating a reliable
asynchronous handoff for later processing.

#### Source of truth and local Redis

- PostgreSQL remains the source of truth. A valid help request is accepted
  only after its database transaction commits; Redis/BullMQ is never the only
  location of an accepted request.
- A Redis outage must not reject a valid PostgreSQL-backed request.
- The existing local Docker Compose setup already provides Redis 8 and Redis
  Insight. This checkpoint consumes `REDIS_URL` and does not modify Compose
  services. Redis Insight is only a local development inspection tool.
- Disposable Redis test infrastructure is deferred. Automated database tests
  continue to use isolated PostgreSQL only.

#### Idempotency contract

`POST /public/countries/:countryCode/help-requests` requires:

```http
Idempotency-Key: <UUID>
```

- The client creates one UUID per logical submission and reuses it for network
  retries.
- The same key and the same normalized request payload return the originally
  stored acknowledgement response with `201 Created`.
- The same key and a different normalized payload return `409 Conflict`.
- PostgreSQL stores idempotency records durably. A SHA-256 fingerprint is
  calculated from a canonical normalized request representation.
- Normalized-email uniqueness remains an independent business rule and
  database-level concurrency safeguard.
- The public acknowledgement stays non-enumerating and never exposes an
  earlier help request.

#### 4A. Database-backed idempotent public intake

**Status:** Complete

**Implementation record:**

- Public `POST /public/countries/:countryCode/help-requests` now requires an
  `Idempotency-Key` UUID header. Missing or malformed keys return the existing
  structured `400` validation response; the key is never accepted in the body.
- After request validation and normalization, the service creates a canonical,
  stable-order representation containing the normalized country and every
  logical request field. A built-in Node SHA-256 hash is its request
  fingerprint.
- `help_request_idempotency` durably stores the key, fingerprint, complete
  acknowledgement fields, acknowledgement timestamp, and creation timestamp.
  The stored response can therefore be replayed exactly without reading the
  original help request.
- One short PostgreSQL transaction stores the idempotency result and, for a
  new key, validates the active country operation and attempts the help-request
  insert. Same key plus same fingerprint replays the original `201` response;
  same key plus a different fingerprint returns `409`.
- The existing partial normalized-email uniqueness rule remains an independent
  database concurrency safeguard. A duplicate email under a different key
  stores a generic acknowledgement but creates no second help request and
  reveals no earlier submission.
- Database uniqueness and transaction behaviour, rather than a process-local
  lock, handle concurrent same-key retries and concurrent different-key
  duplicate-email attempts.

**Verification:** Focused unit tests cover normalized fingerprints,
changed-payload conflict mapping, and exact acknowledgement replay. Isolated
PostgreSQL HTTP tests cover header validation, initial creation, replay,
changed payload, and both concurrent submission paths.

#### 4B. Transactional outbox persistence

**Status:** Complete

**Implementation record:**

- A new help request, its idempotency result, and exactly one
  `help-request-submitted` outbox event now commit or roll back in the same
  short PostgreSQL transaction. Replays and duplicate-email acknowledgements
  that create no help request create no event.
- `outbox_events` stores an identifier-only payload with `outboxEventId` and
  `helpRequestId`; it never stores requester data or other PII. Events are
  persisted only and are not yet published.
- Focused isolated PostgreSQL tests verify first creation, replay,
  duplicate-email acknowledgement, and an induced outbox-insert failure that
  leaves no partial help request, idempotency record, or event committed.

#### 4C. BullMQ outbox publisher

**Status:** Automated verification complete; manual Redis Insight verification
pending

**Implementation record:**

- `REDIS_URL` is required when the API starts. A local five-second publisher
  interval reads a bounded, creation-ordered batch of pending
  `help-request-submitted` events and sends each to `help-request-events`.
  Job data contains only `outboxEventId` and `helpRequestId`.
- Jobs use the stable ID `outbox-<outboxEventId>`, three attempts, exponential
  backoff with modest jitter, and retained completed/failed jobs for local
  Redis Insight inspection. Publication marks `enqueued_at` only after BullMQ
  accepts the job; it never sets `processed_at`.
- If Redis is temporarily unavailable, the event remains pending, its attempt
  count is incremented, and only a generic safe diagnostic is stored.
  A redacted warning identifies the outbox event without logging Redis
  credentials. Publication is at-least-once; it makes no exactly-once claim.
- Manual Redis Insight verification is still pending. For that check, set
  `REDIS_URL` to the existing local Redis endpoint before starting the API,
  submit a request with a fresh idempotency key, then use Redis Insight to
  inspect identifier-only job data, `enqueued_at`, and a still-null
  `processed_at` value.

#### 4D. BullMQ worker behaviour

**Status:** Deferred

Worker processing remains deferred after 4C:

- The first idempotent worker will mark an outbox event processed. It will not
  assign shelters, reserve capacity, notify users, or change request state.

**Deferred:** Worker implementation, disposable Redis integration-test
infrastructure, production job retention/cleanup policy, shelter matching and
reservations, geocoding, notifications, QR/check-in, AI processing, operator
workflow transitions, Bull Board, and operational monitoring UI.

### 5. Short reference on genuinely new submissions

**Status:** Complete

- `help_requests.short_reference` is a separate nullable field beside the
  existing opaque internal `public_reference`. PostgreSQL enforces uniqueness
  and `^[A-Z0-9]{5}$`; null preserves historical pre-Checkpoint-5 rows.
- Each genuinely new public submission creates an uppercase alphanumeric
  five-character reference with Node cryptographic randomness. The insert
  retries a short-reference collision at most five times inside the existing
  transaction. Exhaustion fails safely and rolls back the request,
  idempotency record, and outbox event.
- A newly created request returns:

  ```json
  {
    "acknowledgementReference": "opaque acknowledgement value",
    "shortReference": "A1B2C",
    "status": "PENDING_REVIEW",
    "acknowledgedAt": "ISO timestamp",
    "message": "Your request has been received. Emergency staff will review it."
  }
  ```

- The same `Idempotency-Key` and normalized payload replay the exact durable
  acknowledgement, including `shortReference`. The same key with a different
  payload remains `409 Conflict`.
- A different key with the same normalized email and operation returns the
  generic `201` acknowledgement without `shortReference`; it does not read,
  return, or modify the original request and does not create another outbox
  event. That no-reference acknowledgement is stored for exact replay under
  its own idempotency key.
- The short reference is a public identifier, not a password, secret, lookup
  credential, or authentication mechanism.

**Privacy limitation:** Returning a short reference for a new request and no
reference for a different-key duplicate can reveal prior use of an email. This
is intentionally limited to the controlled synthetic-data PoC, is not
non-enumerating or production-ready, and needs privacy/security redesign before
any real-user or pilot use.

**Acceptance:** The reference and duplicate-response behaviour are implemented,
reviewed, concurrency-safe, and covered by focused tests.

**Verification:** The focused service tests and full disposable PostgreSQL API
E2E suite pass. The E2E suite covers new-reference persistence, exact
idempotency replay, duplicate-email acknowledgement without a reference,
concurrent same-key submission, collision retry, and retry exhaustion rollback.
API unit tests, build, lint, Drizzle schema check, and `git diff --check` also
pass. The generated migration was applied only to the disposable test database,
which was removed after the test run; it was not applied to development.

### 6. Minimal public status lookup

**Status:** Complete

- `GET /public/help-requests/:shortReference/status` is public and returns
  only `{ "status": "<help-request status>" }`.
- The route accepts exactly five alphanumeric characters and normalizes
  lowercase to uppercase before using the unique short-reference lookup.
- Invalid-format and unknown references both return the same generic
  `404 Help request not found` response. The result never includes the
  reference, IDs, requester data, timestamps, operation details, QR data, or
  reservation data.
- The reference is not authentication. This endpoint is limited to the
  controlled synthetic-data PoC: even confirming existence or status can be
  sensitive. Stronger verification, rate limiting and abuse protection, and a
  privacy review are required before any real-world or pilot use.
- Focused isolated PostgreSQL HTTP tests cover a known reference, lowercase
  normalization, exact response shape, and equivalent invalid/unknown `404`
  responses. Existing coverage confirms protected routes remain protected.

**Acceptance:** The minimal lookup contract is implemented, reviewed, and
covered by focused tests without expanding into placement or reservation data.

### 7. Final verification and documentation

- Review schema, migration, public exposure, API contracts, idempotency,
  references, lookup scope, and asynchronous handoff against this iteration.
- Run relevant isolated database tests, API tests, build, lint, Drizzle check,
  and `git diff --check`.
- Document local Redis/BullMQ setup, actual manual-verification results, known
  limitations, and accepted deferred work accurately.

**Acceptance:** Iteration 008 is complete only after the reference and
duplicate-response checkpoint, minimal status lookup checkpoint, focused tests,
and documentation are complete. No shelter capacity or assignment is changed
by a request.

## Explicitly deferred

- AI-assisted conversation, MCP tools, OpenUI, translation, voice, and model-generated summaries.
- Address geocoding, coordinates, routing, maps, and shelter recommendation.
- Shelter matching, capacity reservations, QR codes, assignment decisions, arrivals, and person registration.
- Email confirmation, email verification, SMS, telephone, WhatsApp,
  notifications, and public request editing. The narrow synthetic-data status
  lookup remains limited to the controlled synthetic-data PoC; production-grade
  verification, abuse protection, and privacy controls remain deferred.
- Operator review actions, status transitions, role expansion, production tenant authorization, and production-grade abuse prevention.
- Public intake and operator queue UI, planned for Iteration 009.
- The meaningful BullMQ worker, recovery behaviour, matching, reservations,
  and any business processing of enqueued jobs.
