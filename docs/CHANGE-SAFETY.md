# ZOZ AI — Safe Change Map

This document is the maintenance boundary for the production system.

## Production source of truth
- GitHub: `zozaimanager2026-design/zoz-ai-control`
- Branch: `main`
- Active backend: Railway service `zoz-ai-control`
- Database: PostgreSQL
- Production changes must come from reviewed GitHub changes on `main`.

## Where to make changes

| Area | Safe primary path | Rule |
|---|---|---|
| Digital business templates | `config/digital-business-template-library.js` | Add/edit client-work templates here; keep categories extensible. |
| Template tests | `config/digital-business-template-library.test.js` | Update whenever the template contract changes. |
| Digital execution logic | `digital-business-execution.js` | Change request matching, plans, workflow advancement here. |
| Digital execution API | `api/execution.js` | Keep API/auth separate from business rules. |
| Execution policy / approvals | `config/execution-policy.js` | Financial approval rules are protected; do not bypass them. |
| Core runtime | `autonomous-runtime.js`, `autonomy-core.js`, `scripts/autonomous-heartbeat.js` | Change only when runtime behavior actually requires it. |
| Persistence | `scripts/enable-postgres-persistence.js`, persistence modules/tests | Do not replace or weaken PostgreSQL persistence casually. |
| Media/video | `media-production.js`, `renderers/`, `scripts/repair-legacy-media-state.js` | Keep isolated from the digital-business template library. |
| Public UI | `public/` | UI-only changes belong here; do not move backend logic into the browser. |
| External integrations | `integrations/`, `peach.js`, `youtube.js`, `api/whatsapp-status.js` | Keep provider-specific logic isolated. |
| Environment configuration | Railway variables | Never commit secrets or production credentials to GitHub. |

## Files that should not be used as change mechanisms

Temporary deployment markers, smoke-test marker files, and one-off sync notes are not part of the runtime contract and should not be recreated just to force a deployment. Use the platform's normal deployment/redeploy mechanism.

## Required change sequence

1. Identify the smallest correct production path.
2. Inspect its imports/references before deleting or moving anything.
3. Make the smallest isolated change.
4. Run syntax/tests relevant to the changed area.
5. Verify the production deployment uses the new `main` commit.
6. Verify `/api/persistence/check` and runtime health.
7. Only then continue to the next change.

## Protected behavior

- Financial actions (`payment`, `purchase`, `transfer`, `receive_money`, `collection`) remain behind explicit human approval.
- Removing a template must not remove the underlying execution engine or unrelated media capabilities.
- Do not introduce a second production backend unless it has a defined role and is verified independently.
- Do not make broad refactors while a focused production fix is possible.

## Extension rule

New business categories should be added as data/templates first. New execution code should only be introduced when the existing execution contract cannot support the new category.
