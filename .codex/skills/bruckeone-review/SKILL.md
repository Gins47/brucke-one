---
name: bruckeone-review
description: Review BruckeOne diffs, implementations, migrations, tests, or pull requests against the active checkpoint.
---

# BruckeOne Review

Before reviewing, inspect the Git diff and read these authoritative files:

- `AGENTS.md`
- `apps/api/AGENTS.md` when the review affects the API
- `docs/architecture/overview.md`
- the active document in `docs/iterations/`

Remain read-only unless explicitly asked to make fixes. Review scope compliance, correctness, module boundaries, readability, migration safety, database constraints, transaction behavior, error handling, sensitive-data handling, and focused test coverage.

Categorize each finding as **Blocking**, **Important**, or **Optional**. Explain it in plain language, identify the relevant file, and propose the smallest appropriate fix. Do not recommend features beyond the active checkpoint.

State clearly when no blocking issues are found, and list verification that could not be performed.
