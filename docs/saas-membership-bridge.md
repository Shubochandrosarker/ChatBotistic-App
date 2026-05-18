# SaaS membership bridge

How a WordPress membership becomes a CRM entitlement set.

## The three systems

1. **Memberistic** (WordPress plugin) — owns plans and memberships.
   Seeds the four SaaS tiers and stores per-tier caps in each plan's
   `settings` JSON.
2. **Licenseistic** (WordPress plugin) — owns the license key, status,
   and allowed domains. Optional; the bridge works without it.
3. **WPistic WhatsApp CRM** (this repo) — verifies the signed SSO
   token, provisions the org, and stores the asserted entitlements.

The bridge itself is the **SaaS connector** module shipped inside the
Memberistic plugin (`includes/integrations/class-saas-connector.php`).
It mints the token; the CRM's `/api/sso/login` route consumes it.

## Plan → entitlement mapping

| Plan    | Monthly | Annual  | Conversations/mo | Widgets | Agent seats | Domains | White label |
| ------- | ------- | ------- | ---------------- | ------- | ----------- | ------- | ----------- |
| Free    | $0      | $0      | 200              | 1       | 1           | 1       | no          |
| Starter | $15     | $180    | 2,000            | 1       | 1           | 1       | yes         |
| Growth  | $49     | $468    | 10,000           | ∞       | ∞           | 10      | yes         |
| Agency  | $99     | $1,188  | ∞                | ∞       | ∞           | ∞       | yes         |

**`0` means unlimited** in both the plan `settings` JSON and the
`organizations` columns.

The caps live in the Memberistic plan `settings` JSON under these keys:
`conversations_per_month`, `widget_limit`, `agent_limit`,
`domain_limit`, `white_label`, `api_access`. They are seeded by
`Plans_Repository::seed_default_plans()`.

## Token claims

The connector signs an HMAC-SHA256 token (`base64url(payload).base64url(sig)`)
carrying:

| Claim                | Source                                            |
| -------------------- | ------------------------------------------------- |
| `sub`                | WordPress user ID (maps to `organizations.sso_subject`) |
| `email`, `name`      | WordPress user                                    |
| `plan`               | Memberistic plan slug                             |
| `agent_limit`        | plan `settings.agent_limit`                       |
| `widget_limit`       | plan `settings.widget_limit`                      |
| `domain_limit`       | plan `settings.domain_limit`                      |
| `conversation_limit` | plan `settings.conversations_per_month`           |
| `white_label`        | plan `settings.white_label`                       |
| `license_key`        | Licenseistic license (decrypted) — optional       |
| `license_status`     | Licenseistic status, mapped to the CRM's 4 values |
| `allowed_domains`    | empty by default; inject via the `memberistic_crm_sso_claims` filter |
| `iat`, `exp`         | issued-at / expiry (token TTL, default 300s)      |

The CRM verifies the signature + freshness (`src/lib/sso/token.ts`),
then `provisionFromClaims` (`src/lib/sso/provision.ts`) upserts the org
on `sso_subject` and writes every entitlement onto the `organizations`
row. Migration `012` adds the `conversation_limit` + `white_label`
columns.

## Setup

**WordPress side** — Memberistic → *CRM Connector*:

- Enable the connector.
- Set **CRM base URL** (e.g. `https://crm.example.com`).
- Set **Shared secret** — must equal `SSO_SHARED_SECRET` in the CRM env.
- Place `[memberistic_crm_login]` on a page, or link members to
  `/?memberistic_crm_sso=1`.

**CRM side** — environment variables:

- `SSO_SHARED_SECRET` — identical to the connector's shared secret.
- `SSO_MAX_SKEW_SECONDS` — optional clock-skew tolerance (default 300).

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
- Limits are **stored** but not yet **enforced** in the CRM (no code
  blocks a 4th agent on a 3-seat plan). Enforcement is a separate task.
