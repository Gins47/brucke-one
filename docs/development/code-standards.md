# Coding Standards

These standards apply to project changes. Also follow the root [agent instructions](../../AGENTS.md), applicable directory instructions, and existing code conventions.

## Structure and readability

- Prefer simple, explicit TypeScript and descriptive domain names. Follow the existing formatter, linter, and file naming conventions.
- Organize the API by feature/domain. Keep controllers focused on request validation and HTTP translation; put business rules in services or domain code.
- Use explicit NestJS module dependencies and one shared database pool per API process, closed on shutdown.
- Keep frontend pages, reusable components, session state, and the typed API client clearly separated. Follow existing React and Next.js patterns.
- Avoid speculative abstractions, generic repositories, and unrelated refactoring. Justify new dependencies or infrastructure within the approved scope.
- Add a short, easy-to-understand description for every newly added function explaining its scope. Use inner comments to explain non-obvious reasons or constraints, rather than repeating the code.

## Validation, errors, and sensitive data

- Use strict Zod request schemas, the project validation pipe, appropriate route validation, and explicit response DTOs on the API.
- Preserve established HTTP error conventions. Do not expose database internals, credentials, tokens, or personal data in errors and logs.
- Treat browser input and client-side organization selection as untrusted. Enforce permissions and business rules in the API.
- Minimize personal data. Current public intake is a synthetic-data PoC; do not extend collection or claim production readiness without the relevant design and authorization.
- Show truthful loading, empty, error, unavailable, and not-reported states. Do not present mock values or missing reports as live operational facts.

## Persistence and concurrency

- Define schema changes through Drizzle and inspect the generated version-controlled SQL migration before applying it. Do not synchronize schemas automatically at startup or substitute `drizzle-kit push` for migrations.
- Enforce important uniqueness, reference, and capacity rules in PostgreSQL. Use short transactions and compatible locking for rules spanning rows or tables.
- Preserve historical operations and shelter activations. Never delete persistent database volumes to rerun initialization or migrations.
- Keep durable workflow state in PostgreSQL. Do not rely on process-local locks or memory for correctness across API instances.
- Keep external network calls outside database transactions. Preserve the transactional outbox boundary and assume at-least-once publication when changing asynchronous workflows.

## Tests and verification

- Add focused tests for new behavior, important failures, database constraints, and concurrency-sensitive transactions. Avoid tests that merely repeat implementation details.
- Use the existing disposable PostgreSQL integration workflow; do not target the development database for automated tests.
- Run relevant tests, lint, and build checks for the affected application. Commands and prerequisites belong in the [API README](../../apps/api/README.md) and [web README](../../apps/web/README.md).
- API `npm run lint` applies fixes. For a read-only lint check from `apps/api`, use `npx --no-install eslint "{src,apps,libs,test}/**/*.ts"`.
- For documentation-only changes, check links, consistency, and `git diff --check`; application tests are needed only if executable behavior changes.
- Report actual results and skipped checks. A mock queue test does not verify real Redis/BullMQ integration.
