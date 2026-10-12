# BruckeOne — Agent Instructions

## Architecture

- Follow `docs/architecture/overview.md`.
- Maintain a modular monolith with a stateless API.
- Prefer simple, maintainable solutions over premature abstractions.

## Development Workflow

- Read the relevant iteration document before implementing.
- Read docs/product/v1-scope.md for product context. Treat it as the long-term product target, not authorization to implement features outside the active checkpoint.
- Implement only the checkpoint explicitly requested.
- Inspect existing code before making changes.
- Do not introduce additional dependencies or infrastructure without justification.
- Use database migrations for schema changes.
- Add appropriate tests for new functionality.

## Checkpoint Review

- Run relevant tests and verification commands.
- Summarize files changed, decisions made, and outstanding issues.
- Do not automatically start the next checkpoint.
- Do not commit changes unless explicitly requested.

## Engineering Principles

- Preserve historical emergency-operation and shelter-activation data.
- Enforce important data integrity rules at the database level.
- Avoid unnecessary complexity.
- Treat personal and emergency-response data as sensitive.
