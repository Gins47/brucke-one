# Iteration 005 — Development Admin Authentication

**Status:** In progress  
**Prerequisite:** Iterations 001–004 complete

## Goal and boundaries

Protect the existing API with a simple administrator login for a single-organization development setup. Create one configured admin at application bootstrap if absent; retain all existing organizations and operational data.

This is a development-only setup. The administrator has application-wide access to every organization, including existing records. It does **not** provide organization-level isolation and must not be used for untrusted users or a public deployment.

## Decisions

- Use `ADMIN_USERNAME` and `ADMIN_PASSWORD` from environment configuration (`.env` in local development) to bootstrap an admin user. Never commit actual credentials or print them in logs.
- Bootstrap is disabled by default; it must be explicitly enabled by `ADMIN_BOOTSTRAP_ENABLED=true` in the development environment. If enabled outside development or required configuration is missing, fail startup. Tests use explicit isolated settings.
- Create the `ADMIN` role and the configured admin user only when absent; assign the role when the user is first created. The role name and username are unique in the database.
- If the configured username already exists, skip user creation: do not change its password, role, or other details. If it lacks the `ADMIN` role, fail startup with a clear error instead of promoting it automatically. Changing `.env` does not rotate an existing password.
- Startup is repeatable and safe under concurrent app starts. Use database uniqueness and atomic database operations/transactions so one user and one role exist, with no partially created user. Handle concurrent uniqueness conflicts safely without changing an existing account.
- Store passwords as Argon2id hashes. Authenticate with username and password and issue a signed, expiring JWT access token. Passwords, hashes and signing secrets never appear in responses or logs.
- Store a role with `name`, `type`, and `permissions`, and associate users with roles through `user_roles`. Define one built-in `ADMIN` role with an `ALL` marker. Guard access using the current database role assignment; no generic permissions engine is included. Define and document the exact persisted type and value during the schema checkpoint.
- Except for the login endpoint and any explicitly documented health endpoint, all existing API endpoints require an authenticated admin. There is no public registration, membership API, or organization-association endpoint.
- Keep current business rules, transactions, data, and API payloads intact except for requiring authentication. Follow existing Nest, Drizzle, Zod, and isolated-PostgreSQL test conventions.

## Authentication contract

- `POST /auth/login` accepts a strict `{ "username": "...", "password": "..." }` body and returns an access token. Set and document the precise response shape and expiry.
- Invalid username and password return the same generic `401` response. Missing, malformed, invalid, or expired bearer tokens return `401`.
- Verify JWT signature, allowed algorithm, expiry, issuer and audience; configure a signing secret and fail startup on missing or invalid security configuration. No hardcoded secret or credential defaults.
- An authenticated identity without the current `ADMIN` role receives `403`. Do not rely on a client-supplied role or an unverified token claim. No token or password material in application logs.
- No password reset, rotation, account management, refresh token, token revocation, MFA, or user interface in this iteration.

## Suggested data model

- `roles`: UUID primary key, unique role name, role type, permissions, and audit timestamps.
- `users`: UUID primary key, unique username, password hash, and audit timestamps. Specify and consistently apply a username normalization rule before implementation.
- `user_roles`: user and role foreign keys, with a unique constraint on `(user_id, role_id)` to prevent duplicate assignments.
- Only the global `ADMIN` role is created and used in V1. Organization-specific roles, permissions and memberships require a later design and potentially a migration.

## Checkpoints

Implement, test, review and commit each checkpoint separately. Authentication must be applied to all routes before the system is considered protected.

### 1. Schema and migration

- Define users, roles and `user_roles` in Drizzle, with unique username and role name, foreign keys, and a unique user/role pair. Agree the exact types for role type and permissions; support the agreed single ADMIN / ALL value.
- Generate and review the migration. Do not alter or delete existing organization data.
- Add focused isolated-PostgreSQL constraint coverage for duplicate username, duplicate role name, duplicate user/role assignment and invalid user/role references. Apply the migration to the isolated test database for automated tests.

**Status:** Complete

**Schema decisions:**

- `roles.type` uses the PostgreSQL `role_type` enum with the sole V1 value `GLOBAL`; the planned `ADMIN` role is global rather than organization-scoped.
- `roles.permissions` uses a PostgreSQL `permission_marker[]` array. The sole V1 marker is `ALL`; no permission evaluation engine is introduced.
- Usernames are stored and compared as trimmed lowercase text. The database requires `username = lower(btrim(username))` and enforces uniqueness on this normalized stored value. Future bootstrap and login code must apply the same trim-and-lowercase normalization before querying.

**Verification:** Focused identity constraint coverage passed through the isolated PostgreSQL lifecycle. The migration was applied only to the disposable `brucke_one_test` database during tests and was not applied to the development database.

### 2. Development admin bootstrap

- Validate the explicitly enabled development bootstrap configuration; bootstrap the role, configured user, and user-role assignment atomically and idempotently.
- If the user exists, preserve its password and details. Verify it is already an admin; otherwise fail without promotion. Do not log credentials.
- Test first creation and password verification, repeated bootstrap with a changed environment password, concurrent bootstrap, and existing non-admin rejection. Use the isolated test database.

**Status:** Complete

**Bootstrap decisions:**

- Bootstrap reads `ADMIN_BOOTSTRAP_ENABLED`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`. It is disabled unless explicitly set to `true`, and may run only when `NODE_ENV` is `development` (or unset for local development).
- Passwords use Node's built-in asynchronous `node:crypto` Argon2id API rather than an external dependency. Node.js 24.7.0 or later is required.
- Stored hashes use `argon2id$v1$m=65536,t=3,p=2,l=32$<salt-base64url>$<hash-base64url>`. Every new password uses a fresh 16-byte random salt; memory is 65,536 KiB, passes are 3, parallelism is 2, and output length is 32 bytes.
- Bootstrap uses a transaction and database uniqueness constraints to create the `ADMIN` role, user, and role assignment. Existing users are never changed; an existing user without the `ADMIN` role fails startup.
- Isolated Jest application tests skip automatic bootstrap and exercise it directly with explicit test credentials and development settings.

### 3. Login and JWT authentication

- Add local username/password login, Argon2id verification, JWT issuance, configuration validation, and a small authentication guard.
- Add focused tests for successful login, wrong credentials, and missing/invalid/expired tokens. Do not expose user password hashes.
- No public registration or other identity features.

**Status:** Complete

**Authentication decisions:**

- `POST /auth/login` accepts a strict `{ "username": "...", "password": "..." }` body. It normalizes usernames with trim-and-lowercase, returns the same generic `401` response for unknown users, incorrect passwords, and malformed stored hashes, and returns `{ accessToken, tokenType: "Bearer", expiresIn }` on success.
- Password verification uses the existing versioned Node Argon2id format. Stored parameters are bounded before deriving a candidate hash, and equal-length candidate hashes are compared with `timingSafeEqual`.
- JWT configuration requires `JWT_SECRET` (at least 32 bytes), `JWT_EXPIRES_IN`, `JWT_ISSUER`, and `JWT_AUDIENCE`. The documented local development expiry is `24h`; it is configuration, not a production default. Tokens use HS256 with `sub` set to the authenticated UUID user ID, and verification checks signature, allowed algorithm, expiry, issuer, audience, and subject format.
- `JwtAuthenticationGuard` validates bearer tokens and places the verified user ID on the request for later checkpoints. It is not applied to existing routes until Checkpoint 4, so only the new login endpoint is public by design at this checkpoint.

**Verification:** Focused authentication coverage and the complete isolated PostgreSQL E2E suite passed. The tests cover successful bootstrapped-admin login, generic invalid credentials, malformed and unsupported hashes, strict request validation, missing/invalid/expired tokens, guard subject exposure, and invalid JWT configuration.

### 4. Protect existing routes

- Inventory every existing controller route. Protect all organization, emergency operation, shelter, activation, affected-region and dashboard endpoints with the admin guard. Login and any documented health endpoint are the only public exceptions.
- Verify authorization against current database role assignment. Preserve existing business behaviour, response contracts, and data integrity guarantees.
- Update existing E2E fixtures to authenticate against the isolated test database. Add focused tests proving unauthenticated requests are rejected across representative routes, an authenticated admin can read and write, and a non-admin identity is forbidden. Review the route inventory to prevent gaps.

### 5. Final review and documentation

- Run focused unit and isolated PostgreSQL E2E/integration tests, build, lint, Drizzle migration check, and diff check.
- Document `.env.example` placeholders, bootstrap, login, bearer-token usage, route protection, and how to reuse existing organization data in the README. Do not include real credentials.
- Document the global-admin/single-organization limitation and deferred production security and tenant isolation work.
- Mark the iteration complete only after all checkpoints and review findings are resolved.

## Out of scope

Organization membership, operator personas, shelter residents, people requesting assistance, registration, invitations, admin association endpoints, other roles, a permissions engine, Keycloak/OIDC, frontend login, refresh tokens, password recovery, MFA, audit platform, and AI/LangGraph.

Before any public deployment, separately design tenant authorization, secure credential lifecycle and rotation, rate limiting, TLS, token revocation/session management, recovery and production bootstrap.

## Acceptance criteria

- Explicitly enabled development startup creates the ADMIN role and configured admin if absent; restarts do not overwrite the existing password or elevate existing non-admin accounts.
- Existing organization data remains accessible to the authenticated admin and unchanged by migration/bootstrap.
- Every existing protected endpoint rejects anonymous requests; only an authenticated current admin may use it.
- Login has generic invalid-credential responses and never returns password hashes.
- All test database writes use the isolated test PostgreSQL workflow, and the existing core-domain integrity tests continue to pass.
