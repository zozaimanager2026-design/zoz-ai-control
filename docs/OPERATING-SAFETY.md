# ZOZ AI — Operating Safety Rules

## Production source of truth

- Production application: Railway service `zoz-ai-control`.
- Git source: `main` branch.
- Do not create parallel production services for experiments.
- Do not use temporary marker files to force deployments.

## Change discipline

1. Make one logical change at a time.
2. Update the relevant module, its test, and its contract/schema when applicable.
3. Run syntax/tests before deployment.
4. Deploy only after the change is internally consistent.
5. Verify health and persistence after deployment.
6. Never modify secrets or financial approval rules as part of unrelated work.

## Digital business library

The library is limited to digital client work for the current phase. New categories may be added only when they have a defined workflow, inputs, deliverables, quality checks, and tests.

Video/media production remains a separate capability and is not a library template until deliberately reintroduced.

## Financial safety

Payments, purchases, transfers, receiving money, and collection remain behind explicit human approval. No template or future library extension may bypass this rule.

## Cleanup rule

Temporary deployment markers, one-off migration notes, smoke-test files, and obsolete synchronization files must not be recreated in the repository. Operational changes belong in source/config/tests, not marker artifacts.

## Revenue readiness

Prioritize reusable client deliverables, quality checks, reliable packaging, lead qualification, and repeatable delivery. Do not add a new capability merely to increase the template count.
