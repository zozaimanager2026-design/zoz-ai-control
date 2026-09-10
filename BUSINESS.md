# ZOZ AI — Business Management Layer

The business domain is intentionally separate from connector credentials and from financial execution.

## Implemented domain model

- Leads and sales pipeline: lead → qualified → quote_sent → deposit_pending → deposit_received → sourcing → delivery → completed/cancelled.
- Orders with quoted price and deposit tracking.
- Opportunity records with a 0–100 score and hot-opportunity threshold at 70.
- Product, supplier, expense, customer and report collections reserved in the business state.
- Action planner that marks financial actions as `approval_required`.
- Business summary metrics for the control dashboard.

## Customer contact identity

The customer-facing business channel is the existing **ZOZ AI WhatsApp Business number**. It is the dedicated business contact channel for customer inquiries, quotes, orders, follow-up, and service communication.

**Hazem Ahmed's personal WhatsApp number remains personal** and is reserved for human communication and personal financial/wallet use. It is not required as the ZOZ AI customer-service number.

ZOZ AI operates as the management/automation layer behind the business WhatsApp Business channel. No separate personal identity is required for customer operations.

The WhatsApp Business number must remain connected through the authorized WhatsApp/Meta provider. Its phone number ID and access token belong only in the hosting Environment Variables and must never be committed to the repository or shared in chat.

## Financial safety

ZOZ AI may prepare a quote, organize a customer request, score an opportunity, or create an internal task automatically. It must not collect a deposit, purchase a product, pay a supplier, transfer money, refund, or otherwise receive/withdraw money without human approval.

Customer communication and business operations through the ZOZ AI WhatsApp Business channel do not authorize ZOZ AI to move money. Any payment or wallet action remains under Hazem Ahmed's human approval and control.

## Integration status

`business.js` is the tested domain module and the business API/dashboard are integrated into the existing core. The intended customer channel is the already-connected ZOZ AI WhatsApp Business number; actual API automation still depends on the authorized WhatsApp/Meta provider credentials being available to the hosting environment. No separate ZOZ AI phone identity is required beyond the existing WhatsApp Business number.
