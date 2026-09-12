# ZOZ AI — Blocker Resolution & Alternatives Registry

## Purpose
This document preserves the fallback paths already applied to ZOZ AI so future automation can diagnose a blocker, search for alternatives, execute safe alternatives, verify the result, and report the outcome.

## Active / applied alternatives

### 1. Vercel → Railway runtime fallback
- Vercel remains a deployment target, but its connected scope currently cannot be operated reliably from the available connector.
- Railway was adopted as the production runtime fallback.
- Existing production Railway service: `zoz-ai-control`.
- Do not create another Railway service for this purpose.

### 2. Railway stale-source deployment → direct source upload
- Problem: Railway's existing deployment remained pinned to an older source snapshot even though GitHub `main` advanced.
- Do NOT use `railway redeploy` for this problem: redeploy reuses the exact same source code.
- Preferred manual fallback: Railway Command Palette → `Deploy Latest Commit`.
- Automation fallback: GitHub Actions checks out exact `main` and runs `railway up` against the existing production project/environment/service.
- Required secret: `RAILWAY_TOKEN` in GitHub Actions. Never commit the token to the repository.

### 3. GitHub push → Railway autodeploy troubleshooting path
When a GitHub push does not trigger Railway:
1. Check whether the deployment was skipped.
2. Check Railway watch paths.
3. Confirm Railway GitHub App access to the repository.
4. Confirm a connected GitHub contributor has access.
5. Refresh/reconnect the repository integration if necessary.
6. Use `Deploy Latest Commit` as the immediate fallback.
7. Use the GitHub Actions `railway up` workflow as the deterministic source-upload fallback.

### 4. API repair without replacing the production service
- Runtime repair scripts were added to repair the business API during startup.
- PostgreSQL persistence bootstrap/verification runs before the server starts.
- This avoids creating another service just to test a repair.

### 5. Financial/automation safety boundary
- Automated operational testing is allowed.
- Financial actions remain behind human approval.
- Smoke tests must use non-financial/test-only records and must verify that unauthorized automation calls remain blocked.

### 6. External connector blockers
- A connector not available through the current ChatGPT toolset must not be fabricated.
- For WhatsApp/Meta or similar external approvals, preserve the internal contract and validation layer, then use a manual/provider-specific authorization path when required.
- Credentials and tokens are never invented or committed.

## Future ZOZ AI Blocker Manager

The future blocker manager should operate as a separate control layer with this loop:

`Detect → Diagnose → Search → Rank alternatives → Execute safe alternative → Verify → Record → Report → Escalate only when human action is required`

### Required capabilities
- Detect deployment, authentication, permissions, API, runtime, database, connector, and configuration blockers.
- Search official documentation and available tools before declaring a blocker final.
- Maintain an alternatives registry with: blocker, evidence, attempted path, fallback, prerequisites, result, verification, rollback path, and last-tested time.
- Prefer the lowest-risk alternative that preserves the existing production service.
- Never create duplicate infrastructure when an existing service can be repaired or redeployed.
- Never expose, invent, or store secrets in source code.
- Never perform payments, purchases, transfers, refunds, or other financial actions without explicit human approval.
- Report exactly what was attempted, what succeeded, what remains blocked, and the next executable option.

## Current known blocker
The production Railway service is healthy, but the available Railway connector cannot directly switch the existing service to an arbitrary newer GitHub commit. The repository now contains the deterministic GitHub Actions source-sync workflow; it requires the `RAILWAY_TOKEN` GitHub secret before it can deploy the checked-out `main` source automatically.
