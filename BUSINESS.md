# ZOZ AI — Business Management Layer

The business domain is intentionally separate from connector credentials and from financial execution.

## Implemented domain model

- Leads and sales pipeline: lead → qualified → quote_sent → deposit_pending → deposit_received → sourcing → delivery → completed/cancelled.
- Orders with quoted price and deposit tracking.
- Opportunity records with a 0–100 score and hot-opportunity threshold at 70.
- Product, supplier, expense, customer and report collections reserved in the business state.
- Action planner that marks financial actions as `approval_required`.
- Business summary metrics for the control dashboard.

## Human contact identity

The initial customer-facing WhatsApp channel is owned by **Hazem Ahmed** and uses Hazem's phone number. ZOZ AI operates as the management/automation layer behind that human-owned channel; it is not treated as a separate financial or legal identity.

The WhatsApp number itself must be connected through the authorized WhatsApp/Meta provider. Its phone number ID and access token belong only in the hosting Environment Variables and must never be committed to the repository or shared in chat.

## Financial safety

ZOZ AI may prepare a quote, organize a customer request, score an opportunity, or create an internal task automatically. It must not collect a deposit, purchase a product, pay a supplier, transfer money, refund, or otherwise receive/withdraw money without human approval.

## Integration status

`business.js` is the tested domain module and the business API/dashboard are integrated into the existing core. The human-owned WhatsApp channel is the intended customer contact path; actual WhatsApp authorization remains an external account-ownership step. No separate ZOZ AI phone identity is required at this stage.
