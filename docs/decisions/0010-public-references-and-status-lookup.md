# ADR 0010 — Short public references and status-only lookup

**Status:** Accepted for controlled synthetic-data use only; recorded retrospectively on 2026-11-10.

## Context and decision

A genuinely new help request receives a unique, cryptographically generated five-character uppercase alphanumeric short reference. Existing historical requests may have no short reference. A same-key retry replays the original acknowledgement. A different-key duplicate email gets a generic acknowledgement without the earlier request or a short reference.

A public endpoint accepts the short reference and returns the request status only. Invalid and unknown references return the same generic `404`. The short reference is a public identifier, not authentication or a placement confirmation.

## Consequences

The differing duplicate response can reveal previous email use, and the lookup can reveal whether a reference exists or its status. This is limited to controlled synthetic data. Before any real-world or pilot use, stronger verification, rate limiting/abuse protection, and privacy/security redesign are required. No matching, reservation, QR code, or status-transition workflow follows from this decision.

## Evidence

- [Iteration 008 Checkpoints 5–6 and accepted limitations](../iterations/008-public-help-request-intake.md)
- [Short-reference migration](../../apps/api/drizzle/20261106104141_cooing_kinsey_walden/migration.sql), [intake/status service](../../apps/api/src/help-requests/help-requests.service.ts), and [HTTP tests](../../apps/api/test/public-help-requests.e2e-spec.ts)
