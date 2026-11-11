# Iteration 010 — Admin Session Persistence

**Status:** Planned

## 1. Goal

Allow an authenticated admin to refresh the Brücke One dashboard without logging in again, while preserving the existing JWT verification and ADMIN authorization.

The implementation will use the existing JWT in an HttpOnly browser cookie. It will not introduce a server-side session table or refresh-token mechanism.

## 2. Current behavior

- Admin login returns a JWT in the response body.
- The dashboard stores the token and selected organization in memory.
- Protected API requests send the token using the Authorization: Bearer header.
- Refreshing the browser clears the frontend state, requiring the admin to log in again.
- Logout clears frontend state but does not revoke the JWT.
- The API verifies the JWT and checks the user’s current ADMIN role in the database.

## 3. Intended behavior

1. The admin signs in through a browser-specific login endpoint.
2. The API sets an HttpOnly cookie containing the existing JWT and returns the admin’s identity without returning the JWT to JavaScript.
3. The browser includes the cookie in subsequent API requests.
4. After a page refresh, the dashboard calls GET /auth/me and restores the authenticated state.
5. The admin selects an organization again after refreshing.
6. Logout clears the browser cookie and frontend authentication state.
7. An expired or invalid token requires the admin to log in again.

The existing Bearer-token login and authorization flow remain available for API consumers, tests, curl and Postman.

## 4. Scope

### Included

- Browser-specific admin login using the existing credential validation.
- JWT cookie transport for protected dashboard requests.
- A protected current-admin endpoint: GET /auth/me.
- A browser logout endpoint that clears the authentication cookie.
- Credentialed frontend requests.
- Exact-origin CORS configuration for the documented local frontend.
- Protection against cross-site requests for browser login, logout and cookie-authenticated state-changing requests.
- Focused API and frontend tests.
- Local configuration and manual verification documentation.

### Excluded

- A database-backed session table or server-side JWT revocation.
- Refresh tokens or automatic JWT renewal.
- Redis-backed sessions.
- New roles, account management or organization-level permissions.
- Persisting the selected organization across refreshes.
- Production deployment or an assertion that the PoC is production-ready.

## 5. API and security decisions

### Browser and Bearer login

Add a separate browser login endpoint while preserving the existing login contract for Bearer clients.

The browser login endpoint must:

- Reuse the current username/password validation.
- Set the JWT in an HttpOnly cookie.
- Return the authenticated admin’s identity without returning the JWT in the response body.
- Use the configured JWT expiration; the documented development configuration remains 24 hours.

The existing login endpoint continues to return its current Bearer-token response.

### Protected requests

The existing authentication guard will accept a JWT from either:

- The Authorization: Bearer header; or
- The browser authentication cookie.

Both transports must use the same JWT verification and current ADMIN authorization checks.

If both credentials are supplied, the Bearer header takes precedence. An invalid Bearer token must not silently fall back to a valid cookie.

### Current admin identity

The JWT guard currently attaches `authenticatedUserId` after verifying the JWT.
The ADMIN guard already queries the database to verify the current role
assignment. Extend that existing query to select only `users.id` and
`users.username`, and attach the verified identity to the request only after
authorization succeeds. The protected `GET /auth/me` returns only:

```json
{
  "id": "<user UUID>",
  "username": "<username>"
}
```

Preserve `authenticatedUserId` for existing consumers, including the assignment
controller, and preserve existing `401` and `403` behavior. Public routes bypass
the guard, so do not treat identity attached to a public request as authorized.
Never attach a password hash or a complete user row. Do not add the username to
the JWT merely to avoid a lookup.

### Cookie configuration

For the documented local setup:

- Use a host-only cookie; do not set Domain.
- Set HttpOnly.
- Set Path=/.
- Set SameSite=Lax.
- Keep cookie expiry no longer than the configured JWT lifetime.
- Use a consistent cookie name and matching attributes when clearing it.
- Support local HTTP without Secure only in the explicitly documented development configuration.
- Require Secure for an HTTPS deployment.

The exact cookie configuration must be validated against the actual frontend/API URLs. A future cross-site deployment requires separate design and testing.

### CORS and cross-site request protection

The documented local frontend and API run on different origins. Browser requests must use credentials, and the API must allow credentials only for the configured exact frontend origin.

For browser login, logout and cookie-authenticated state-changing requests:

- Validate the request’s Origin against the trusted frontend origin.
- Require the agreed custom request header.
- Reject missing or untrusted origins and missing required headers.
- Add the custom header to the narrow CORS allowlist.

CORS is not considered sufficient CSRF protection on its own.

Preserve the existing contracts for public help-request endpoints and explicit Bearer clients. The implementation must define and test how it identifies cookie-authenticated requests, including requests that present both credentials.

### Logout limitation

Logout clears the browser cookie but does not revoke an already-issued or copied JWT. Such a token may remain usable until expiration, provided the user still passes the existing authorization checks.

This is an accepted limitation for the local synthetic-data PoC.

## 6. Checkpoints

### Checkpoint 1 — API cookie authentication

Implement the browser authentication flow while keeping existing Bearer consumers working.

**Tasks**

- Add a browser-specific login endpoint that sets the JWT cookie and returns the admin identity without the token.
- Extend authentication to accept the cookie and preserve the existing Bearer path.
- Implement the documented credential-precedence rule.
- Add protected GET /auth/me returning the current admin’s ID and username.
- Add a browser logout endpoint that clears the cookie.
- Configure exact-origin credentialed CORS.
- Implement the agreed origin and custom-header checks for browser-cookie operations.
- Preserve public intake and existing Bearer-client behavior.

**Focused verification**

Reuse and extend existing API tests where practical. Cover:

- Browser login and cookie attributes.
- Cookie-authenticated access to /auth/me.
- Missing, invalid and expired credentials.
- Current ADMIN role removal.
- Logout cookie clearing.
- Existing Bearer access and the both-credentials precedence rule.
- Trusted and untrusted browser mutation requests.

**Acceptance:** A browser client can authenticate and access protected API endpoints through the cookie. Existing Bearer and public intake contracts continue to work.

**Implementation record (2026-11-11):** Implemented and verified; review and
acceptance pending. `POST /auth/browser/login` returns the authenticated ID and
username and sets the host-only `brucke_admin` HttpOnly cookie. The cookie is
`SameSite=Lax`, uses `Path=/`, expires at the JWT expiration, and is insecure
only for the documented localhost development origin. `POST /auth/browser/logout`
clears it without revoking issued tokens. Both browser endpoints require the
trusted `Origin` and `X-Brucke-Request: 1`.

The JWT guard accepts the cookie or an Authorization header, with the header
taking precedence and no fallback on failure. Cookie-authenticated mutations
require the same origin and header checks. The existing ADMIN lookup supplies
the protected `GET /auth/me` identity; current 401/403 behavior, Bearer login,
and public intake remain in place. Credentialed development CORS allows the
configured exact origin. The dashboard has not yet been switched to cookies.

Verification with Node 24.22.0: focused authentication and authorization E2E
tests passed (2 suites, 14 tests); the full isolated PostgreSQL E2E suite passed
(24 suites, 169 tests); API unit tests passed (16 suites, 72 tests); API build,
non-mutating ESLint, and `git diff --check` passed. E2E rollback tests logged
their expected forced failures. Migrations were applied only to the dedicated
disposable test database; no development database migration was applied.

### Checkpoint 2 — Dashboard session restoration

Update the dashboard to use the cookie-based API flow.

**Tasks**

- Replace token-in-React-state behavior with authentication state such as checking, authenticated and unauthenticated.
- Call /auth/me on application startup before redirecting protected pages.
- Use credentialed API requests and the required custom header.
- Keep the JWT out of React state, local storage and frontend request headers.
- After a successful refresh, return the admin to organization selection.
- Call the logout endpoint and clear local state.
- Preserve existing stale-response and cancellation protections.
- Distinguish a confirmed unauthenticated response from a network failure during restoration.
- If logout cannot reach the API, do not claim that the server-side cookie was cleared.

**Focused verification**

Reuse existing frontend tests where practical. Cover:

- Session restoration after remount or refresh.
- An expired or invalid session returning the user to login.
- A restoration network error being shown distinctly from an expired session.
- Logout behavior.
- Credentialed requests and the required browser header.
- Existing stale-response protection.

**Acceptance:** Refreshing the dashboard preserves admin login without exposing the JWT to frontend JavaScript. Logout and expired-session behavior are clear to the user.

### Checkpoint 3 — Final verification and documentation

**Tasks**

- Run relevant focused tests and the API and web test suites.
- Run API and web lint and build checks.
- Manually verify the local flow:
  1. Log in.
  2. Select an organization and open a protected page.
  3. Refresh the browser and confirm login is restored.
  4. Select an organization again.
  5. Log out and confirm protected access is no longer available through that browser.
  6. Verify expired or invalid session behavior.
- Document local setup, cookie and origin configuration, Bearer compatibility and known limitations.
- Update project status and the iteration index with actual verification results.

**Acceptance:** The local admin flow can be reproduced and its limitations are accurately documented. Mark the iteration complete only after the applicable automated and manual checks are recorded.

## 7. Risks and limitations

- This is a development PoC, not a live emergency service.
- A copied JWT is not revoked when the browser logs out.
- HttpOnly reduces JavaScript access to the token but does not prevent malicious JavaScript from making authenticated requests.
- The 24-hour expiry is a development decision, not a production recommendation.
- The existing ADMIN role is not organization-specific authorization.
- Production deployment, HTTPS, CSRF policy, identity management and privacy requirements require further review.
