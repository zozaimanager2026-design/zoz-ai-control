# ZOZ AI — WhatsApp live connection

## Current implementation

The production application already contains the WhatsApp Business Cloud API webhook contract:

- `GET /api/whatsapp/webhook` — Meta webhook verification.
- `POST /api/whatsapp/webhook` — receives WhatsApp events, validates `x-hub-signature-256` when `WHATSAPP_APP_SECRET` is configured, and converts incoming messages into ZOZ AI customers/leads.
- Incoming WhatsApp messages are persisted through the existing ZOZ state persistence when production persistence is configured.
- Financial actions remain behind the human-approval gate.

## Production environment variables

Set these as hosting environment variables only; never commit their values:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET` (recommended; required for signed webhook verification)
- `WHATSAPP_API_VERSION` (optional; defaults to `v23.0`)

## Meta webhook

Configure the WhatsApp Business webhook callback to the active public production URL plus:

`/api/whatsapp/webhook`

Use the exact same `WHATSAPP_VERIFY_TOKEN` value in Meta and in the hosting environment.

Subscribe the WhatsApp Business account/phone-number webhook to the message event.

## Live business flow

Incoming message -> WhatsApp webhook -> customer/lead upsert -> business pipeline -> safe operational follow-up.

Any deposit, purchase, supplier payment, transfer, refund, or receipt of money is still approval-required and is not executed automatically.

## No-secret rule

Do not put access tokens, app secrets, verify tokens, or Railway/Vercel secrets in GitHub source files. They belong only in the production hosting environment.
