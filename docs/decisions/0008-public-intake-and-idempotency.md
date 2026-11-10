# ADR 0008 — Country-scoped public intake with durable idempotency

**Status:** Accepted for the synthetic-data proof of concept; recorded retrospectively on 2026-11-10.

## Context and decision

Expose a minimal public list of active operations per country and accept a structured help request only for an active operation in that country. New requests begin in `PENDING_REVIEW`; they do not reserve a shelter. Preserve a protected, operation-scoped operator queue under the existing global ADMIN guard.

Require a UUID `Idempotency-Key` on submission. Persist a fingerprint of the normalized request and its acknowledgement in PostgreSQL: the same key and payload replay the response, while the same key with a changed payload returns a conflict. A partial unique constraint prevents multiple requests with the same normalized optional email within one operation.

## Consequences

Retry handling survives process restarts and concurrent submissions. The queue is filtered by operation but does not provide organization-membership authorization. Different-key duplicate acknowledgements can reveal prior email use under the short-reference contract; see [ADR 0010](0010-public-references-and-status-lookup.md). Public abuse protection and production privacy/security design remain deferred.

## Evidence

- [Iteration 008 intake and idempotency](../iterations/008-public-help-request-intake.md)
- [Intake service](../../apps/api/src/help-requests/help-requests.service.ts), [DTOs](../../apps/api/src/help-requests/help-requests.dto.ts), and [public API tests](../../apps/api/test/public-help-requests.e2e-spec.ts)
