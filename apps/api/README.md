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

```bash
$ npm install
```

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

## Dashboard read endpoints

All dashboard endpoints are read-only. Replace the placeholder UUIDs with IDs
from your environment.

### Organization overview

Returns the organization identity, operation status counts, shelter count, and
active shelter activation count.

```bash
curl http://localhost:3000/dashboard/organizations/11111111-1111-1111-1111-111111111111/overview
```

### Organization operations

Returns operations sorted by `updatedAt DESC, id DESC`. `limit` defaults to 25
and has a maximum of 100. `status` is optional. The response's `nextCursor` is
opaque; pass it back as `cursor` to load the next page.

```bash
curl "http://localhost:3000/dashboard/organizations/11111111-1111-1111-1111-111111111111/operations?limit=25&status=ACTIVE"

curl --get \
  --data-urlencode "limit=25" \
  --data-urlencode "cursor=<nextCursor-from-the-previous-response>" \
  http://localhost:3000/dashboard/organizations/11111111-1111-1111-1111-111111111111/operations
```

### Emergency operation map projection

Returns one operation summary, its current affected regions, active shelters
with coordinates, and the count of active shelters without coordinates.

```bash
curl http://localhost:3000/dashboard/emergency-operations/22222222-2222-2222-2222-222222222222/map
```
