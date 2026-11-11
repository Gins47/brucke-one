# Iterations and Checkpoints

Iteration files preserve their original scope, implementation records, and acceptance evidence. Each begins with a current checkpoint assessment, reconciled against repository sources on the date shown. For the project-wide picture, see [status](../status.md).

| Iteration | Current assessment |
| --- | --- |
| [001 — Project foundation](001-project-foundation.md) | Foundation implemented; development Compose and runtime-verification gaps remain. |
| [002 — Core domain](002-core-domain.md) | Schema implemented; original database constraint-test list is only partially covered. |
| [003 — Core operations API](003-core-operations-api.md) | Six implementation checkpoints present; later acceptance recorded in 008. |
| [004 — Dashboard read models](004-dashboard-read-models.md) | Implemented; historical query review used small fixtures. |
| [005 — Development admin authentication](005-identity-and-organization-authorization.md) | Implemented for a global development ADMIN; tenant isolation deferred. |
| [006 — Operations dashboard UI](006-operations-dashboard-ui.md) | Implemented; desktop/mobile walkthrough and live-tile checks remain unverified. |
| [007 — Shelter availability and readiness](007-shelter-availability-and-readiness.md) | Implemented; the later physical-capacity decrease guard exists, while pre-existing inconsistent reports and deterministic concurrent testing remain outstanding. |
| [008 — Public help-request intake](008-public-help-request-intake.md) | Backend scope accepted; real Redis verification pending, worker deferred. |
| [009 — Manual shelter assignment](009-manual-shelter-assignment.md) | Complete; accepted by the user for the synthetic demo after the user-reported dashboard walkthrough. A separate follow-up review of the Checkpoint 3 fixes is not recorded. |

## Status definitions

- **Implemented:** Relevant code or configuration exists. Tests or runtime behavior are identified separately; implementation alone does not prove every acceptance criterion.
- **Partial:** Some original tasks or evidence are missing. Explain the missing pieces.
- **Historically recorded / accepted:** An iteration document records a past review, result, or acceptance. This is not a new approval or a fresh test result.
- **Verification pending:** The implementation may exist, but the named test, manual check, or environment-specific evidence is absent or has not been established.
- **Deferred:** The work is explicitly outside the accepted delivery scope and is not implemented by that checkpoint.

Historical checkpoint notes describe the system at that point in time. Later iterations may extend or replace their behavior. Read each current assessment and the later linked sources before relying on an older contract. A status, planned iteration, or decision record does not authorize implementation; work remains limited to the checkpoint explicitly requested by the user.
