# PSS Logistics cross-panel capability matrix

This matrix records the CargoWale-inspired capabilities that are appropriate for PSS. It is an adaptation plan, not a copy of CargoWale’s UI, code, branding, or data model.

| Capability | Client | Admin | Master | Hero | Source of truth |
| --- | --- | --- | --- | --- | --- |
| Profile and KYC status | View/edit own profile; show verification state | View and support | Manage rules and decisions | Login/recovery only | Supabase profile + Worker authorization |
| Bank accounts | Secure own-account workflow | View/verify | Audit/control | — | Worker/D1 with masked output and audit log |
| API and webhooks | View masked status and own configuration | Troubleshoot | Create, scope, rotate, revoke | — | Worker API-key/webhook tables |
| Courier and channel settings | View enabled capabilities | Support view | Activate, price, and audit | — | Worker provider policy and capability state |
| WhatsApp | Configure consent and event subscriptions | Support view | Templates and pricing | — | Worker dispatch, retry, billing ledger |
| Wallet and recharge | Use own wallet and view ledger | Support view | Adjust/approve | — | Worker wallet ledger; no withdrawal flow |
| Billing and COD remittance | View invoices, settlements, exports | Assist and escalate | Approve and reconcile | — | Worker billing/remittance records |
| Bulk upload | Validate, preview, edit, retry, confirm | Operational assistance | Monitor and audit | — | Existing PSS booking API and idempotency |
| AI assistant | Read-only first | Read-only operational use | Permissioned admin tools | — | Same Worker permissions as normal UI |

## Current implementation boundary

- Client navigation is grouped into Shipment Operations, Network & Serviceability, Pricing & Finance, Exceptions & Support, and Account & Preferences.
- Admin and Master navigation use role-aware grouped modules. Unsupported modules must remain clearly read-only or disabled.
- Courier-returned rates must never be displayed as the client’s billable amount. Client billing remains based on the PSS rate-card formula once finalized.
- CargoWale comparison does not authorize adding a bank, WhatsApp, payment, or AI provider. Those require a PSS data model, server-side authorization, audit logging, idempotency, and provider credentials first.
- Hero remains public tracking/authentication only; it must not expose client operational controls.

## Verification gates

Each capability is release-ready only after TypeScript/build checks, authenticated role tests, tenant-isolation tests, API contract tests, idempotency/retry tests, and responsive/accessibility checks pass. UI presence alone is not evidence of a production workflow.
