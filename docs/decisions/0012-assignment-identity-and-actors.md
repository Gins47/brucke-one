# 0012 — Assignment identity and actors

**Status:** Approved direction for Iteration 009; schema implementation pending review. Automated assignment is future work.

## Context

An assignment connects a help request to a shelter activation. Future product
work may create assignments automatically, while Iteration 009 only permits an
authenticated development ADMIN to assign manually.

## Decision

Use the neutral table name `help_request_shelter_assignments` for the assignment
itself. Require `assigned_by_user_id` for the manual assignments in this
iteration. Automated assignment requires a deliberate actor-model and schema
change; do not invent a system user or add speculative automation fields now.

## Consequences

The table name does not preclude a future automated workflow, but the required
user reference intentionally means the current schema does not support one.
This decision does not authorize automatic allocation or determine its actor,
audit, or authorization design.

## Sources

- [Iteration 009, Checkpoint 1](../iterations/009-manual-shelter-assignment.md#checkpoint-1--assignment-schema-and-migration)
- [Proposed V1 placement policy](0011-proposed-v1-placement-policy.md)
