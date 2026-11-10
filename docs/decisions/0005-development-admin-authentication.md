# ADR 0005 — Development-only global administrator authentication

**Status:** Accepted for the development proof of concept; recorded retrospectively on 2026-11-10.

## Context and decision

Protect API routes with signed JWT bearer authentication and a database-checked current global `ADMIN` assignment. Bootstrap the configured administrator only when explicitly enabled for development; do not overwrite an existing password or promote an existing non-admin. Store passwords using Node's Argon2id implementation and normalize usernames before lookup/storage. The login endpoint and narrowly marked public help-request endpoints bypass the global guard.

## Consequences

The administrator can access every organization. An organization selected by the UI or used to filter a query is not tenant isolation. Existing tokens are not revoked by browser logout. Organization membership, production authentication, credential rotation/recovery, rate limiting, and session/token revocation remain separate future work.

## Evidence

- [Iteration 005 decisions](../iterations/005-identity-and-organization-authorization.md) and [Iteration 008 public-route boundary](../iterations/008-public-help-request-intake.md)
- [Admin bootstrap](../../apps/api/src/auth/admin-bootstrap.service.ts), [authorization guard](../../apps/api/src/auth/admin-authorization.guard.ts), and [password hashing](../../apps/api/src/auth/password-hash.ts)
