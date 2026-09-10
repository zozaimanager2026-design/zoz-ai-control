# ZOZ AI — Business Management Layer

The business domain is intentionally separate from connector credentials and from financial execution.

## Implemented domain model

- Leads and sales pipeline: lead → qualified → quote_sent → deposit_pending → deposit_received → sourcing → delivery → completed/cancelled.
- Orders with quoted price and deposit tracking.
- Opportunity records with a 0–100 score and hot-opportunity threshold at 70.
- Product, supplier, expense, customer and report collections reserved in the business state.
- Action planner that marks financial actions as `approval_required`.
- Business summary metrics for the control dashboard.

## Financial safety

ZOZ AI may prepare a quote, organize a customer request, score an opportunity, or create an internal task automatically. It must not collect a deposit, purchase a product, pay a supplier, transfer money, refund, or otherwise receive/withdraw money without human approval.

## Integration status

`business.js` is the tested domain module. The existing `server.js` core remains unchanged while the domain module is validated independently. The next integration step is to expose this domain state through the existing API/dashboard without replacing the current core or creating another Vercel project.
