# Documentation — Start Here

Use this page to find the minimum context needed for a task.

## Reading order for coding agents

1. Read the root [agent instructions](../AGENTS.md) and [project status](status.md).
2. Read the [project process](development/project-process.md), including skill selection, and [coding standards](development/code-standards.md).
3. Read the [product scope](product/v1-scope.md), [architecture overview](architecture/overview.md), and [tech stack](architecture/tech-stack.md).
4. Read the explicitly requested checkpoint in [iterations](iterations/), then inspect the relevant code and any instructions applying to its directory.

For documentation-only or other focused tasks, read the relevant sources without reconstructing every past iteration. No implementation checkpoint is selected merely by reading these documents.

## Where to look

| Question | Source |
| --- | --- |
| What is complete, active, or awaiting verification? | [Status](status.md) |
| How do we select skills, implement, and review work? | [Project process](development/project-process.md) |
| How should code be written and tested? | [Coding standards](development/code-standards.md) |
| Which technologies are in use? | [Tech stack](architecture/tech-stack.md) |
| How does the system fit together? | [Architecture overview](architecture/overview.md) |
| What is the intended V1 product? | [Product scope](product/v1-scope.md) |
| What does a checkpoint require, and what is its current status? | [Iteration index](iterations/README.md) and the relevant iteration document |
| Why were significant choices made? | [Decision index](decisions/README.md) |
| How do I run the applications? | [API README](../apps/api/README.md) and [web README](../apps/web/README.md) |
| What additional rules apply to API changes? | [API agent instructions](../apps/api/AGENTS.md) |

## Document responsibilities

Keep current progress in `status.md`, stable working rules in agent instructions and development guides, technology choices in the tech stack, and delivery evidence in iteration records. Link to the owner of a fact instead of copying it across documents.

Code, configuration, tests, and migrations establish what exists. Product and architecture plans describe intent; they do not authorize future work. If a material discrepancy affects a task, report it and resolve it within the user's requested scope.
