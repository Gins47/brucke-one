# BruckeOne — Agent Instructions

## Start Here

- Use `docs/README.md` as the documentation entry point.
- Read `docs/status.md` for current delivery state and the explicitly selected checkpoint, if any. Status and roadmap entries do not authorize new work.
- Follow `docs/development/code-standards.md` and `docs/development/project-process.md`, including its skill-selection guidance.
- Read `docs/architecture/tech-stack.md` for current technology choices; package manifests, lockfiles, and configuration own exact versions.

## Architecture

- Follow `docs/architecture/overview.md`.
- Maintain a modular monolith with a stateless API.
- Prefer simple, maintainable solutions over premature abstractions.

## Development Workflow

- Read the relevant iteration document before implementing.
- Read docs/product/v1-scope.md for product context. Treat it as the long-term product target, not authorization to implement features outside the active checkpoint.
- Implement only the checkpoint explicitly requested.
- Inspect existing code before making changes.
- When a decision made during an iteration checkpoint could affect the product beyond that checkpoint, document it in `docs/decisions/` and update the decision index. Follow `docs/decisions/README.md` to record its context, decision, consequences, status, and supporting links; link to any superseded decision. Recording a decision does not authorize additional scope.
- Do not introduce additional dependencies or infrastructure without justification.
- Use database migrations for schema changes.
- Add appropriate tests for new functionality.
- Add a short, easy-to-understand description for every newly added function that explains its scope.

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
