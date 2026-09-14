# ZOZ AI — Digital Business Execution

This is an additive branch of ZOZ AI. It does not replace or disable existing Core, dashboard, connectors, business systems, WhatsApp, approvals, memory, or other established modules.

## Mission
Receive a digital task, understand its requirements, choose the required skills/tools, execute safe work, quality-check it, package deliverables, deliver/follow up, and record experience for future work.

## Mobile-first control
The phone is the permanent control surface: intake, status, review, approval gates, task creation, cycle triggering, and delivery monitoring are available through the mobile execution page/API. The phone is not required to perform every low-level operation manually.

## Autonomy
Autonomy is durable when PostgreSQL is configured. The execution state stores tasks, opportunities, skills, tools, experience, audit events, and the autonomy heartbeat. Scheduled execution is exposed through `/api/execution-cycle`; manual mobile control is exposed through `/api/execution` and `/execution-mobile.html`.

## Safety
Financial actions are never autonomous. Purchase, payment, transfer, withdrawal, receiving money, paid subscriptions, and similar commitments remain behind human approval.

## Skills
Brand identity, PDF/documents, marketing design, writing/content, websites, software, automation/API, data/analysis, and media are initial skills. New skills/tools can be added without removing existing ZOZ AI systems.

## Important implementation boundary
The execution engine is the orchestration foundation. Actual third-party production actions still require their corresponding connector/tool to be configured and verified. A queued task must not be reported as delivered merely because the orchestration stage advanced.
