# Decision Records

These records collect significant decisions from the iteration documents and current repository. They were written retrospectively on 2026-11-10; their recording date is not a claim about when a decision was first made. Each links to its underlying iteration and implementation evidence.

| Record | Decision | Scope/status |
| --- | --- | --- |
| [0001](0001-api-and-persistence-foundation.md) | Modular API and PostgreSQL persistence | Accepted; implemented foundation |
| [0002](0002-historical-domain-integrity.md) | Operational history and shelter ownership | Accepted; implemented domain constraints |
| [0003](0003-explicit-api-contracts.md) | Explicit API validation and domain-owned commands | Accepted; implemented API conventions |
| [0004](0004-dashboard-read-projections.md) | Read-only dashboard projections and keyset pagination | Accepted; implemented dashboard API |
| [0005](0005-development-admin-authentication.md) | Global development ADMIN authentication | Accepted for development; tenant isolation deferred |
| [0006](0006-web-dashboard-sessions-and-maps.md) | Next.js dashboard, in-memory sessions, and Leaflet maps | Accepted for development; manual checks outstanding |
| [0007](0007-activation-availability-snapshots.md) | Activation-specific availability snapshots | Accepted; physical-capacity update gap and concurrency test outstanding |
| [0008](0008-public-intake-and-idempotency.md) | Country-scoped public intake and durable idempotency | Accepted for synthetic data; abuse protection deferred |
| [0009](0009-transactional-outbox-publication.md) | Transactional outbox and BullMQ handoff | Publisher accepted; worker and real Redis verification pending |
| [0010](0010-public-references-and-status-lookup.md) | Short references and status-only lookup | Accepted for synthetic data with documented privacy limits |
| [0011](0011-proposed-v1-placement-policy.md) | V1 placement and AI boundaries | Proposed product direction; not implemented or approved by this record |
| [0012](0012-assignment-identity-and-actors.md) | Shared assignment identity and required manual actor | Iteration 009 schema implemented; review pending; automation deferred |

## How to use and maintain these records

- A record captures context, the decision, consequences, status, and source links. Code, migrations, and configuration establish current implementation; iterations carry checkpoint scope and delivery evidence.
- Acceptance is limited to the scope stated in each record. A product proposal, retrospective record, or future direction does not authorize new implementation.
- Add a new numbered record when a significant choice changes. Link to the superseded record and update its status rather than silently rewriting the historical rationale.
- Keep exact dependency versions in manifests and lockfiles; link to [tech stack](../architecture/tech-stack.md) for the current inventory. Track active work and unresolved verification in [status](../status.md).
