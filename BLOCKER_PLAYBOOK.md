# ZOZ AI — Blocker Playbook

## Purpose

ZOZ AI must continue progressing when one provider API or connector is unavailable. A connector failure is a routing problem, not a reason to stop safe work.

## Vercel API / MCP 403 fallback

If the Vercel connector returns `403`, `Not authorized`, `0 teams`, or cannot access `zoz-ai-control`:

1. Do **not** repeatedly reconnect or create a second Vercel project.
2. Keep the existing GitHub → Vercel integration unchanged.
3. Perform all repository changes, tests, security checks, and workflow changes through GitHub.
4. Use GitHub Actions as the independent verification channel for production health and safety boundaries.
5. Verify unauthenticated access to `/api/automation/cycle` is rejected with HTTP `401` or `503`.
6. Never bypass `CRON_SECRET` and never copy the production secret into source code.
7. Treat Vercel runtime state as **not directly verified** until an independent production check succeeds.
8. Once Vercel API access is restored, re-run the production monitor and compare deployment/runtime state before making further changes.

## Current independent checks

`.github/workflows/production-monitor.yml` runs every six hours and can also be started manually. It checks:

- `/api/health`
- `/api/self-test`
- `/api/readiness`
- unauthenticated protection of `/api/automation/cycle`

## Security rules

- `CRON_SECRET` is a hosting secret only.
- Financial operations remain human-approval gated.
- Do not invent credentials or tokens.
- Do not expose secrets in logs, commits, or workflow output.
- Do not create, delete, or replace Vercel projects as a workaround.

## Recovery rule

When the same blocker appears again, reuse this playbook first: continue through GitHub/CI, record the limitation, and return to Vercel only when the connector itself is healthy.