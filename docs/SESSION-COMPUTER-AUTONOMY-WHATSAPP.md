# ZOZ AI — Computer Session Completion Checklist

## Priority 1: durable autonomy
- [ ] Production deployment is running the current `main` branch.
- [ ] `DATABASE_URL` is configured and PostgreSQL persistence reports `durable:true`.
- [ ] `CRON_SECRET` and `EXECUTION_API_SECRET` are configured with non-empty secrets.
- [ ] `/api/execution` is reachable from the mobile control screen.
- [ ] `/api/execution-cycle` runs successfully from production.
- [ ] Existing financial approval rules remain enforced.
- [ ] Existing ZOZ AI systems and connectors remain intact.
- [ ] A mobile-only smoke test creates a safe non-financial task and observes its persisted progress.

## Priority 2: real WhatsApp automation
- [ ] Peach API key configured as a Vercel environment variable.
- [ ] Approved Peach template ID configured.
- [ ] Business phone number configured and verified.
- [ ] Outbound test succeeds without exposing secrets.
- [ ] Incoming webhook endpoint is reachable and verified.
- [ ] Incoming messages are persisted to the CRM/state.
- [ ] Reply routing can generate a response and send it through the approved channel.
- [ ] Duplicate webhook protection is enabled.
- [ ] Financial/purchase/payment conversations remain behind human approval.

## Priority 3: execution tool connectors
Connect at least one real executor for each initial skill family:
- design/brand
- documents/PDF
- content
- image/video
- websites/software (GitHub/Codex/Vercel)
- automation/APIs
- data

The execution engine must record which tool produced each deliverable and must not mark an external task as completed merely because an internal state advanced.

## Mobile operating principle
The phone is the control plane: intake, approval, monitoring, review, delivery and alerts. Heavy execution may happen in connected cloud tools. The system must remain usable without requiring the user to sit at the computer for routine monitoring.

## Definition of done for this session
Autonomy is not considered complete until production persistence, scheduled execution, mobile control, real external execution, and the financial approval gate have all been verified. WhatsApp is not considered complete until both outbound and inbound flows are verified end-to-end.
