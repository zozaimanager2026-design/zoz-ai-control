# ZOZ AI Deployment Fallback

## Policy
ZOZ AI does not stop because the primary hosting provider is blocked.

- Primary: Vercel.
- Fallback: a Node/Express-capable host must be used for a real production fallback; static GitHub Pages is not considered equivalent because ZOZ AI requires the Express API and financial-safety boundaries.
- A fallback is considered active only after the deployed URL passes `/api/health`, `/api/self-test`, `/api/readiness`, the protected `/api/automation/cycle` check, and the mobile control-surface check.
- No financial transaction is executed automatically during fallback validation.
- Vercel remains the primary target and is retried after its external deployment limit clears.

## Current state
The repository is ready for fallback deployment, but no alternate Node host credentials are currently available to this repository. Therefore this file intentionally does not claim that a fallback URL is live.

## Activation rule
When an alternate Node/Express host credential becomes available, deploy the same `main` commit, run the checks above, record the verified URL in the deployment monitor, and use it as the fallback target when the primary deployment is unavailable.
