## Project setup

Run API commands from `apps/api`. Copy `.env.example` to `.env` and adjust
`DATABASE_URL` for your local database. Existing environment variables take
precedence over `.env`. Start the existing PostgreSQL service with
`docker compose up -d postgres` from the repository root.

The API imports `DatabaseModule` explicitly and uses one shared PostgreSQL pool.
It verifies the connection during startup and closes the pool during shutdown.
`CONNECTION_TIMEOUT` is a positive integer in milliseconds and defaults to 5000.
Startup does not apply migrations. The HTTP and database integration tests
require PostgreSQL to be running; database tests use read-only queries.

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

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
