---
name: bruckeone-implementation
description: Implement or modify BruckeOne code, tests, migrations, or iteration documentation within an approved checkpoint.
---

# BruckeOne Implementation

Before editing, inspect Git status and read these authoritative files:

- `AGENTS.md`
- `apps/api/AGENTS.md` when the work affects the API
- `docs/architecture/overview.md`
- the active document in `docs/iterations/`

Implement only the explicitly approved active checkpoint. If the request exceeds its scope, stop and ask for clarification.

Keep the implementation simple, explicit, domain-focused, and easy to read. Do not add dependencies, generic repositories, infrastructure, abstractions, or speculative features without explicit approval. Keep controllers thin and place business logic in the relevant feature or domain module. Use PostgreSQL constraints and short transactions for important integrity rules.

Add short, clear documentation for exported or non-obvious functions, and inner comments only when they clarify non-obvious code. Do not add comments that merely restate the code.

Write focused tests for the requested operation, important failures, database constraints, and transaction-sensitive behavior. Avoid shallow or duplicate tests. Inspect generated migration SQL before applying it. Run relevant verification commands, report their actual results, and do not commit unless explicitly asked.
