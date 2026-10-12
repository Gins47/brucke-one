# BruckeOne — Architecture Overview

**Status:** Evolving target architecture  
**Last reviewed:** 2026-10-11

## 1. Purpose and boundaries

BruckeOne is an AI-assisted emergency-response coordination platform connecting relief organizations, emergency operations, shelters, field teams, and affected residents. The core system must work without AI. AI assists human coordinators; it does not autonomously dispatch life-critical resources, issue medical instructions, or publish unapproved official alerts.

The initial product scope is **one relief organization managing multiple emergency operations and shelters**. Cross-organization collaboration, low-connectivity operation, and country-independent deployments are longer-term goals, not current capabilities.

## 2. Architectural principles

- **Modular monolith first.** Keep cohesive domain boundaries in a single NestJS API. Do not create microservices solely for architectural appearance.
- **Stateless API processes.** Persist durable business state in PostgreSQL, not process memory. Multiple API instances should be possible without changing business correctness.
- **PostgreSQL as system of record.** Enforce critical invariants with database constraints and transactions; use version-controlled, reviewed migrations.
- **Explicit dependencies.** NestJS feature modules import the database module explicitly. Use a shared `pg.Pool` per API process and close it on shutdown.
- **Reliable behavior before distributed complexity.** Introduce background workers, outbox, brokers, and caches when a concrete use case requires them.
- **Human oversight and privacy.** Require authorized human review for consequential AI-assisted actions. Minimize resident personal data, protect access, and preserve appropriate audit history.
- **Incremental evolution.** Architectural intent does not authorize implementation; approved iteration checkpoints do.

## 3. Technology direction

| Component             | Choice                                                         | Decision status                                     |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Core backend          | NestJS / TypeScript                                            | Decided                                             |
| Backend structure     | Modular monolith; stateless HTTP API                           | Decided                                             |
| Operational database  | PostgreSQL 18                                                  | Decided                                             |
| Vector capability     | pgvector (`pgvector/pgvector:0.8.6-pg18`)                      | Decided for local DB image; vector features planned |
| SQL access            | Drizzle ORM + `pg` connection pool                             | Decided                                             |
| Schema evolution      | Drizzle Kit migrations, SQL reviewed before application        | Decided                                             |
| Local development     | Existing Docker Compose with PostgreSQL                        | Existing configuration; runtime must be verified    |
| AI integration        | Separate Python / FastAPI service                              | Planned, not yet implemented                        |
| Coordinator interface | Web UI; Next.js is a candidate                                 | Planned; framework not final                        |
| Background processing | PostgreSQL-backed worker/outbox first when needed              | Planned; broker not yet selected                    |
| Cloud / operations    | CI, staging, monitoring, backups, load tests, cloud deployment | Planned; provider/topology not final                |

## 4. System context and component boundaries

```text
                  Coordinator / field users
                             |
                     Web UI (planned)
                             |
                      HTTPS / REST
                             |
                +-------------------------+
                | NestJS modular monolith |
                | organizations           |
                | operations              |
                | shelters                |
                | shelter activations     |
                | future domain modules   |
                +-------------------------+
                     |             |
                     v             +------> Python AI service (planned)
             PostgreSQL + pgvector             | read-only tools,
              source of truth                 | approved RAG, human review
                     |
              Outbox / workers (planned)
                     |
             Messaging / notifications (planned)
                     |
             External providers (planned)
```

The NestJS API owns business rules and writes authoritative operational data. The planned AI service must not bypass authorization or directly mutate operational records without an approved API workflow. No message broker, AI service, or web UI is required to complete the current foundation work.

## 5. Domain model and ownership

### Agreed concepts

- **Organization:** Relief organization with UUID identity, human-readable code, name, and optional contact/address information.
- **Emergency Operation:** Named response effort, geographic scope, lifecycle status, and owning organization.
- **Shelter:** Reusable physical facility with location and physical capacity; not permanently tied to an operation.
- **Shelter Activation:** Historical association between a shelter and an emergency operation, with activation lifecycle and operation-specific capacity/occupancy as appropriate.

```text
Organization 1 --- N EmergencyOperation
EmergencyOperation 1 --- N ShelterActivation
Shelter 1 --- N ShelterActivation (over time)
```

**V1 invariant:** At most **one ACTIVE activation per physical shelter** across all operations. Enforce this in PostgreSQL, for example with a partial unique index on `shelter_id` where `status = 'ACTIVE'`. Closing an activation retains its historical row; do not delete the association to make a shelter reusable.

### Planned domains

- **Inventory and resources:** Food, water, medicine categories, vehicles, quantities, and unmet needs.
- **Volunteers:** People and shelter/operation assignments, with appropriate authorization.
- **Affected people:** Minimal, access-controlled registrations and shelter stays.
- **Incident reports:** Field/resident submissions, location resolution, duplicate detection, and triage.
- **Communications:** Approved announcements, delivery tracking, multilingual notifications.

Exact schemas, country-neutral geographies, and permissions remain design tasks; these planned domains are not approved for implementation by this document.

## 6. Data integrity and reliability direction

- UUIDs are internal primary keys; human-readable codes are separate business identifiers.
- Prefer database constraints over pre-insert checks for uniqueness and concurrency guarantees.
- Use short transactions for related writes and business invariants; do not hold database locks during external network calls.
- For future reliable asynchronous processing, use a transactional outbox when an event must survive API crashes. Assume at-least-once publication and design idempotent consumers.
- For future external notifications, distinguish broker acceptance, provider acceptance, and recipient delivery. Do not claim exactly-once external effects without provider support.
- Define authorization, audit retention, and sensitive-data handling before collecting real resident data.

## 7. Infrastructure and deployment direction

The existing local Compose definition uses `pgvector/pgvector:0.8.6-pg18`, database `brucke_one`, user `brucke`, a named PostgreSQL volume, and `infra/postgresql/init.sql`. Bind exposed development ports to localhost where practical. Initialization scripts run on first database initialization only; **never delete a volume to force an initialization script to rerun**.

Application schema changes are applied via reviewed Drizzle migrations, not automatic startup synchronization. A shared database pool is created per NestJS process and shut down cleanly. CI, staging deployment, monitoring, recovery objectives, and load testing will be designed incrementally.

## 8. Evolution roadmap (capabilities, not implementation authorization)

1. **Foundation:** Verify existing repository/Compose; configure NestJS database access, Drizzle migrations, and connection tests.
2. **Core operations:** Organization, emergency operation, physical shelter, shelter activation; validation, tests, and concurrency constraints.
3. **Shelter workflows:** Reservations, occupancy, stock, volunteers, affected-person registrations, and reports.
4. **Reliable coordination:** Outbox, background processing, notifications, retries, deduplication, and audit.
5. **AI assistance:** Approved-source RAG, read-only tools, summaries, evaluations, and human-in-the-loop actions.
6. **Production and reach:** CI/CD, deployment, observability, backups, fault injection, scaling, and low-connectivity channels.

## 9. Open architecture decisions

- Authentication, role-based/organization-scoped authorization, and personal-data retention.
- Geographic hierarchy, GPS/landmark handling, and offline sync conflict resolution.
- Capacity accounting, reservations, and inventory unit semantics.
- Notification provider, broker selection, and delivery reconciliation policies.
- AI model/provider, retrieval/evaluation design, and permitted tool actions.
- Web framework, cloud hosting, resilience targets, and deployment topology.

## 10. Documentation authority

- `docs/architecture/overview.md`: Target architecture, principles, boundaries, and open decisions.
- `docs/decisions/`: Accepted architecture decision records (ADRs).
- `docs/iterations/`: Approved scope, checkpoint acceptance criteria, and implementation progress.
- `AGENTS.md` and `apps/api/AGENTS.md`: Stable Codex working instructions, not checkpoint status.
- Repository code and migration history: What is actually implemented.

**Important:** Planned architecture is not evidence of completed functionality and does not authorize Codex to implement future components outside the explicitly requested checkpoint.
