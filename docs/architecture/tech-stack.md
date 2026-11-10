# Tech Stack

**Last checked against repository configuration:** 2026-11-10

This file describes checked-in technology choices. Package manifests, lockfiles, runtime pins, and Compose configuration own exact versions; this is not a recommendation to upgrade them.

## Current stack

| Area | Technology and purpose | Repository source |
| --- | --- | --- |
| Runtime | Node.js; both applications require `>=24.7.0`. Use their checked-in `.nvmrc` files. | [API package](../../apps/api/package.json), [web package](../../apps/web/package.json) |
| API | NestJS, TypeScript, Express HTTP adapter; modular monolith with stateless API processes | [API](../../apps/api/) |
| Database | PostgreSQL 18 using the local `pgvector/pgvector:0.8.6-pg18` image | [Compose](../../docker-compose.yaml) |
| Data access | Drizzle ORM and `pg`; Drizzle Kit generates and applies reviewed migrations | [API package](../../apps/api/package.json), [migrations](../../apps/api/drizzle/) |
| Validation | Zod and the project-owned NestJS validation pipe | [Validation](../../apps/api/src/common/validation/) |
| Authentication | NestJS JWT integration and Node Argon2id password hashing; development ADMIN access | [Auth module](../../apps/api/src/auth/) |
| Asynchronous handoff | PostgreSQL transactional outbox, BullMQ, NestJS BullMQ integration, and Redis via ioredis; publisher implemented, worker deferred | [Publisher](../../apps/api/src/outbox-publisher/) |
| Local queue inspection | Redis 8 and Redis Insight through Docker Compose | [Compose](../../docker-compose.yaml) |
| Web application | Next.js App Router, React, TypeScript, Tailwind CSS, and local shadcn-style UI components | [Web package](../../apps/web/package.json), [UI components](../../apps/web/src/components/ui/) |
| Maps | Leaflet and React Leaflet with OpenStreetMap tiles | [Web README](../../apps/web/README.md) |
| API testing | Jest, Supertest, and disposable PostgreSQL integration tests; BullMQ test double | [API package](../../apps/api/package.json), [test configuration](../../apps/api/test/) |
| Web testing | Vitest, React Testing Library, and jsdom | [Web package](../../apps/web/package.json) |
| Code checks | ESLint; API formatting also uses Prettier | Application package scripts and checked-in configuration |

## Planned or available only

- pgvector is available in the database image; embeddings and vector search are not implemented product features.
- A separate Python/FastAPI AI service is architectural direction, not an implemented service.
- Geocoding/routing, AI integration, notifications, and business workers require their own approved checkpoints.
- Cloud hosting, production deployment topology, and production operations remain future decisions.

See [status](../status.md) for delivery and verification state, [architecture](overview.md) for boundaries, and the application READMEs for setup. Runtime availability is not established solely by a dependency or Compose entry being present.
