## Project setup

Run API commands from `apps/api`. Copy `.env.example` to `.env` and adjust
`DATABASE_URL` for your local database. Existing environment variables take
precedence over `.env`. Start the existing PostgreSQL service with
`docker compose up -d postgres` from the repository root.

The API imports `DatabaseModule` explicitly and uses one shared PostgreSQL pool.
It verifies the connection during startup and closes the pool during shutdown.
`CONNECTION_TIMEOUT` is a positive integer in milliseconds and defaults to 5000.
Startup does not apply migrations. The HTTP and database integration tests
start a dedicated PostgreSQL container, apply the reviewed migrations, and
remove the container and its volume when they finish. They use
`TEST_DATABASE_URL` and never use the development `DATABASE_URL`.

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

`POST /auth/login` is the only public API route. It accepts a strict username
and password body and returns a bearer token:

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

Set `JWT_SECRET` to a configured secret of at least 32 bytes, and set
`JWT_EXPIRES_IN`, `JWT_ISSUER`, and `JWT_AUDIENCE` in `.env`. The local
development example uses a 24-hour expiry; choose an explicit security policy
for any non-local environment. Tokens use HS256 and are verified for their
signature, expiry, issuer, audience, and UUID user subject. Existing API
routes require a bearer token for a user with a current `ADMIN` role assignment.
There is no public health endpoint. Send the token with protected requests:

```bash
curl http://localhost:3000/organizations \
  --header 'Authorization: Bearer <access-token>'
```

ADMIN access is application-wide in this development setup; it does not
provide organization-level isolation. This is a single trusted-admin setup
without production session management, token revocation, or tenant isolation.

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

### Emergency operation map projection

Returns one operation summary, its current affected regions, active shelters
with coordinates, and the count of active shelters without coordinates.

```bash
curl http://localhost:3000/dashboard/emergency-operations/22222222-2222-2222-2222-222222222222/map \
  --header 'Authorization: Bearer <access-token>'
```
