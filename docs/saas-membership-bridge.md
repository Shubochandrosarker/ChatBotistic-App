# SaaS membership bridge

How a WordPress membership becomes a CRM entitlement set.

## The systems

1. **Memberistic** (WordPress plugin) — owns plans and memberships.
   Seeds the four SaaS tiers and stores per-tier caps in each plan's
   `settings` JSON.
2. **Licenseistic** (WordPress plugin) — owns the license key, status,
   and allowed domains. Optional; the bridge works without it.
3. **WPistic WhatsApp CRM** (this repo) — verifies the signed SSO
   token, provisions the org, and stores the asserted entitlements.
4. **Chatbotistic Widget** (WordPress plugin) — the customer-installed
   chat widget. Activates against Licenseistic on chatbotistic.com.

The membership→CRM bridge is the **SaaS connector** module inside the
Memberistic plugin (`includes/integrations/class-saas-connector.php`).
It mints the token; the CRM's `/api/sso/login` route consumes it.

## Plan → entitlement mapping

Pricing is metered on **active contacts per month**, with pay-as-you-go
overage above the included allowance (the ManyChat model).

| Plan    | Monthly | Annual* | Active contacts/mo | Widgets | Agents | Domains | White label | PAYG |
| ------- | ------- | ------- | ------------------ | ------- | ------ | ------- | ----------- | ---- |
| Free    | $0      | $0      | 50                 | 1       | 1      | 1       | yes         | no   |
| Starter | $9      | $90     | 300                | 5       | 5      | 5       | yes         | yes  |
| Growth  | $49     | $490    | 7,000              | ∞       | ∞      | 10      | yes         | yes  |
| Agency  | $99     | $990    | 20,000             | ∞       | ∞      | ∞       | yes         | no   |

`0` means **unlimited** in both the plan `settings` JSON and the
`organizations` columns. Every tier — including Free — ships the fully
white-labelled chat widget.

\* Annual prices use a 2-months-free placeholder (monthly × 10) — adjust
in `Plans_Repository::seed_default_plans()` if your offer differs.

Caps live in the Memberistic plan `settings` JSON under these keys:
`active_contacts_per_month`, `widget_limit`, `agent_limit`,
`domain_limit`, `white_label`, `api_access`, `pay_as_you_go`.

## Token claims

The connector signs an HMAC-SHA256 token (`base64url(payload).base64url(sig)`)
carrying:

| Claim             | Source                                            |
| ----------------- | ------------------------------------------------- |
| `sub`             | WordPress user ID (maps to `organizations.sso_subject`) |
| `email`, `name`   | WordPress user                                    |
| `plan`            | Memberistic plan slug                             |
| `agent_limit`     | plan `settings.agent_limit`                       |
| `widget_limit`    | plan `settings.widget_limit`                      |
| `domain_limit`    | plan `settings.domain_limit`                      |
| `contact_limit`   | plan `settings.active_contacts_per_month`         |
| `white_label`     | plan `settings.white_label`                       |
| `license_key`     | Licenseistic license (decrypted) — optional       |
| `license_status`  | Licenseistic status, mapped to the CRM's 4 values |
| `allowed_domains` | empty by default; inject via the `memberistic_crm_sso_claims` filter |
| `iat`, `exp`      | issued-at / expiry (token TTL, default 300s)      |

The CRM verifies the signature + freshness (`src/lib/sso/token.ts`),
then `provisionFromClaims` (`src/lib/sso/provision.ts`) upserts the org
on `sso_subject` and writes every entitlement onto `organizations`.
Migration `012` adds the `contact_limit` + `white_label` columns.

## Setup

**WordPress** — Memberistic → *CRM Connector*: enable it, set the CRM
base URL, and a **shared secret** matching `SSO_SHARED_SECRET` in the
CRM env. Place `[memberistic_crm_login]` on a page, or link members to
`/?memberistic_crm_sso=1`.

**CRM** — env vars: `SSO_SHARED_SECRET` (must match the connector) and
optional `SSO_MAX_SKEW_SECONDS` (default 300). Run migration `012`.

## Login flow

1. Member clicks **Launch CRM** (`/?memberistic_crm_sso=1`).
2. The connector resolves the member's active plan + license, builds
   the claims, signs the token, and redirects to
   `{CRM}/api/sso/login?token=…`.
3. The CRM verifies the token, provisions the org + owner membership,
   and starts a Supabase session landing on `/dashboard`.

A member with no active membership is treated as the **Free** tier.

## Notes

- `seed_default_plans()` only runs on **first install**. An existing
  Memberistic install keeps its old plans — delete them and re-seed,
  or create the four tiers manually with the caps above.
- Pay-as-you-go overage billing is **not** implemented — `pay_as_you_go`
  is recorded on the plan as a flag for a future metered-billing step.
- Limits are **stored** but not yet **enforced** in the CRM.
