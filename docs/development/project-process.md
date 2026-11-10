# Project Process

## Start a task

1. Read the root [agent instructions](../../AGENTS.md), [documentation entry point](../README.md), and [status](../status.md).
2. Identify the user's requested scope. For implementation, locate the explicitly approved iteration checkpoint; a future roadmap item or the next iteration number does not select it.
3. Read the [coding standards](code-standards.md), [product context](../product/v1-scope.md), [architecture](../architecture/overview.md), [tech stack](../architecture/tech-stack.md), and any applicable directory instructions.
4. Inspect Git status and existing code before editing. Preserve unrelated changes and working configuration.

Explicit requests for documentation, investigation, or review can be handled within that scope without selecting a new product checkpoint.

## Use skills deliberately

Skills contain task-specific instructions in a `SKILL.md` file. Select the skill that fits the requested work, read it before applying it, and briefly tell the user which skill is being used. Merely naming a skill in a document does not run it.

| Task | Repository skill | Expected behavior |
| --- | --- | --- |
| Implement or modify code, tests, migrations, or iteration records within an approved checkpoint | [bruckeone-implementation](../../.codex/skills/bruckeone-implementation/SKILL.md) | Inspect first, implement only the approved scope, verify, and report results. |
| Review a checkpoint implementation, diff, migration, tests, or PR | [bruckeone-review](../../.codex/skills/bruckeone-review/SKILL.md) | Remain read-only unless fixes were requested; classify findings as Blocking, Important, or Optional. |

Use other available skills when explicitly requested or when their documented scope fits the task. If a required skill cannot be found, report that rather than pretending to have applied it. Skills guide execution; they do not approve additional features, commits, or infrastructure. Explicit user instructions take precedence over skill guidance.

## Implement one checkpoint

- Confirm tasks, acceptance criteria, and exclusions from its iteration document.
- Make the smallest maintainable change. Follow the coding standards and relevant application instructions.
- Review generated migrations and preserve historical data. Do not reset persistent databases or volumes.
- Add appropriate focused tests and run the relevant checks. Report blocked or unavailable checks precisely.
- Update the checkpoint implementation record with changes, decisions, commands/results, and unresolved limitations. Update [status](../status.md) with the checkpoint's actual state.

## Review and acceptance

- Review the diff against the requested scope and acceptance criteria, using the review skill when applicable.
- Distinguish implementation complete from review pending and accepted. Only record acceptance when supported by explicit approval or an existing acceptance record.
- Keep automated verification separate from manual verification. Carry unresolved checks forward even when a scoped delivery is accepted with limitations.
- Report files changed, meaningful decisions, verification results, and outstanding issues.
- Stop after the requested checkpoint. Do not start the next checkpoint or commit without explicit instruction.

## Maintain the documentation

Keep progress in `docs/status.md`, technologies in the tech-stack document, coding conventions in code standards, workflow and skill selection here, and detailed delivery evidence in iteration documents. Update the relevant owner when behavior changes and link to it from other documents. Preserve historical checkpoint evidence rather than rewriting it as though it described today's full application.
