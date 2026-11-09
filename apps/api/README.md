## Project setup

Run API commands from `apps/api`. Copy `.env.example` to `.env` and adjust
`DATABASE_URL` for your local database. Existing environment variables take
precedence over `.env`. The API's outbox publisher also requires `REDIS_URL`.
Start the local PostgreSQL, Redis, and Redis Insight services from the
repository root:

```bash
docker compose up -d postgres redis redis-insight
```

The API imports `DatabaseModule` explicitly and uses one shared PostgreSQL pool.
It verifies the connection during startup and closes the pool during shutdown.
`CONNECTION_TIMEOUT` is a positive integer in milliseconds and defaults to 5000.
Startup does not apply migrations. The HTTP and database integration tests
start a dedicated PostgreSQL container, apply the reviewed migrations, and
remove the container and its volume when they finish. They use
`TEST_DATABASE_URL` and never use the development `DATABASE_URL`.

When the local frontend runs on `http://localhost:3001`, set
`NODE_ENV=development` and `WEB_ORIGIN=http://localhost:3001` in the API `.env`.
The API then permits only that origin and the `Content-Type` and `Authorization`
headers through CORS. CORS is not enabled by this configuration outside
development.

## Runtime requirement

The API requires Node.js 24.7.0 or later for its built-in Argon2id password
hashing support. From `apps/api`, use the pinned development version:

```bash
nvm use
```

The `engines.node` field communicates this requirement to npm, but npm may
only warn when the active runtime is incompatible.

```bash
$ npm install
```

## Local development authentication

Use placeholders in your local `.env`; never commit credentials or signing
secrets. The following is the minimum development authentication setup:

```ini
NODE_ENV=development
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/<database>
ADMIN_BOOTSTRAP_ENABLED=true
ADMIN_USERNAME=<development-admin-username>
ADMIN_PASSWORD=<development-admin-password>
JWT_SECRET=<at-least-32-byte-signing-secret>
JWT_EXPIRES_IN=24h
JWT_ISSUER=brucke-one-api
JWT_AUDIENCE=brucke-one-api
REDIS_URL=redis://127.0.0.1:6379
```

Bootstrap is disabled by default. With `ADMIN_BOOTSTRAP_ENABLED=true` in
development, application startup creates the configured ADMIN user only when
it is absent. Later starts preserve its password and role assignment. Startup
fails if the configured username already exists without ADMIN; it never
promotes that user automatically.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# isolated PostgreSQL integration tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Development authentication

Start the API after configuring `.env`:

```bash
npm run start:dev
```

`POST /auth/login` is public. It accepts a strict username and password body
and returns a bearer token:

```bash
curl --request POST http://localhost:3000/auth/login \
  --header 'content-type: application/json' \
  --data '{"username":"configured-admin-username","password":"configured-admin-password"}'
```

```json
{
  "accessToken": "<opaque-jwt>",
  "tokenType": "Bearer",
  "expiresIn": "24h"
}
```

The public help-request endpoints are documented below. All other existing API
routes require a bearer token for a user with a current `ADMIN` role
assignment. Set `JWT_SECRET` to a configured secret of at least 32 bytes, and set
`JWT_EXPIRES_IN`, `JWT_ISSUER`, and `JWT_AUDIENCE` in `.env`. The local
development example uses a 24-hour expiry; choose an explicit security policy
for any non-local environment. Tokens use HS256 and are verified for their
signature, expiry, issuer, audience, and UUID user subject. There is no public
health endpoint. Send the token with protected requests:

```bash
curl http://localhost:3000/organizations \
  --header 'Authorization: Bearer <access-token>'
```

ADMIN access is application-wide in this development setup; it does not
provide organization-level isolation. This is a single trusted-admin setup
without production session management, token revocation, or tenant isolation.

## Public help-request PoC

The following narrow endpoints are public for the controlled synthetic-data
PoC:

- `GET /public/countries/:countryCode/emergency-operations` lists active
  operations for a country.
- `POST /public/countries/:countryCode/help-requests` requires an
  `Idempotency-Key` UUID header. A new request returns a five-character
  `shortReference`; a different-key duplicate normalized email receives a
  generic acknowledgement without one.
- `GET /public/help-requests/:shortReference/status` normalizes a
  five-character alphanumeric reference and returns only the request status.
  Invalid and unknown references both return a generic `404` response.

The short reference is not authentication. Status lookup and the
duplicate-response behavior are not suitable for real personal data without
stronger verification, rate limiting and abuse protection, and privacy review.
A generic acknowledgement confirms receipt only; it does not confirm a shelter
assignment.

The operator queue remains protected:

```bash
curl http://localhost:3000/emergency-operations/11111111-1111-1111-1111-111111111111/help-requests \
  --header 'Authorization: Bearer <access-token>'
```

## Local outbox publication

Each genuinely new help request commits its outbox event with the request in
PostgreSQL. The API polls pending events and publishes identifier-only jobs to
the local `help-request-events` BullMQ queue. Redis Insight is available at
`http://localhost:5540` for local inspection.

An enqueued job is not business-processed: the BullMQ worker is deferred, so no
publisher action assigns a shelter, reserves capacity, changes request status,
or notifies a requester. Automated API tests mock BullMQ and do not connect to
the development Redis instance.

## Dashboard read endpoints

All dashboard endpoints are read-only. Replace the placeholder UUIDs with IDs
from your environment.

### Organization overview

Returns the organization identity, operation status counts, shelter count, and
active shelter activation count.

```bash
curl http://localhost:3000/dashboard/organizations/11111111-1111-1111-1111-111111111111/overview \
  --header 'Authorization: Bearer <access-token>'
```

### Organization operations

Returns operations sorted by `updatedAt DESC, id DESC`. `limit` defaults to 25
and has a maximum of 100. `status` is optional. The response's `nextCursor` is
opaque; pass it back as `cursor` to load the next page.

```bash
curl "http://localhost:3000/dashboard/organizations/11111111-1111-1111-1111-111111111111/operations?limit=25&status=ACTIVE" \
  --header 'Authorization: Bearer <access-token>'

curl --get \
  --data-urlencode "limit=25" \
  --data-urlencode "cursor=<nextCursor-from-the-previous-response>" \
  --header 'Authorization: Bearer <access-token>' \
  http://localhost:3000/dashboard/organizations/11111111-1111-1111-1111-111111111111/operations
```

### Organization shelters

Returns the selected organization's stable shelter facts and, when one exists,
its current active activation, operation, and availability report. The list is
unpaginated for the small development dataset; it is a dashboard convenience,
not an authorization boundary.

```bash
curl http://localhost:3000/dashboard/organizations/11111111-1111-1111-1111-111111111111/shelters \
  --header 'Authorization: Bearer <access-token>'
```

### Shelter activation availability

Availability is a complete current snapshot for one shelter activation. A GET
returns `availability: null` when no report exists. A PUT requires active
parents and returns `409` if the parent state or physical shelter capacity does
not permit the report. `availablePlaces` is derived from the submitted values
and is never stored.

```bash
curl http://localhost:3000/shelter-activations/33333333-3333-3333-3333-333333333333/availability \
  --header 'Authorization: Bearer <access-token>'
```

### Emergency operation map projection

Returns one operation summary, its current affected regions, active shelters
with coordinates, active-shelter availability coverage, and the count of
active shelters without coordinates. Capacity totals cover only shelters with
a reported availability snapshot.

```bash
curl http://localhost:3000/dashboard/emergency-operations/22222222-2222-2222-2222-222222222222/map \
  --header 'Authorization: Bearer <access-token>'
```
