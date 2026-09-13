# Billing, checkout, emails & licenses — the full chain

This is the complete money→license→email pipeline for Chatbotistic, so
every surface (marketing site, CRM app, WordPress SaaS site, customer
widget plugin) can be wired consistently.

## Domains (canonical)

| Domain | Role |
|---|---|
| `www.chatbotistic.com` | Marketing + WordPress SaaS (Memberistic + Licenseistic + the four connector plugins) |
| `app.chatbotistic.com` | Custom Chatbotistic dashboard/CRM and customer-facing app origin |
| `services.tochat.be` | Private Tochat backend/API and widget loader origin |
| `crm.chatbotistic.com` | Temporary migration alias only; redirect, then retire permanently |

## Plans (single source of truth)

Defined by `memberistic-licenseistic-bridge` caps and mirrored in
`/pricing`:

| Plan | Price | Widgets | Agents | Domains | Seats | Messages/mo |
|---|---|---|---|---|---|---|
| Free Forever | $0 | 1 | 1 | 1 | 1 | 100 |
| Starter | $19/mo | 3 | 5 | 3 | 2 | 1,000 |
| Growth | $49/mo | 10 | 20 | 10 | 5 | 5,000 |
| Agency | $149/mo | 30 | ∞ | 50 | 15 | 25,000 |

The CRM app enforces `widget_limit` / `agent_limit` at creation time
(`src/lib/tochat/entitlements.ts`), synced onto `organizations` by the
SSO bridge from the live Memberistic plan.

## Checkout paths

1. **WordPress (live today):** Memberistic checkout on
   chatbotistic.com → membership activated → the bridge auto-issues a
   Licenseistic license → key emailed by the branded template.
2. **Paddle v2 overlay (this app, `/pricing`):** env-driven, one build
   serves sandbox and live. Paddle.js is initialized with the public
   client-side token; no Paddle API secret is shipped to the browser.
   - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` — Paddle client token
   - `NEXT_PUBLIC_PADDLE_ENV` — `sandbox` (default) | `live`
   - `PADDLE_PRICE_FREE` / `PADDLE_PRICE_STARTER` / `PADDLE_PRICE_GROWTH` /
     `PADDLE_PRICE_AGENCY` — server-side price IDs read at request time
   - Buttons degrade to disabled with a tooltip when a price ID is unset.
   - The webhook endpoint must be configured in the WPistic control plane;
     checkout UI events are not treated as proof of payment.

   To go live: create the four prices in Paddle (sandbox first, pattern
   in the WPistic platform's `docs/PADDLE_TESTING.md`), set the env
   vars, and point the Paddle **notification destination** at the
   license webhook (below).

## License webhook → issuance → email

The proven chain from the WPistic platform (api.wpistic.com), to be
reused for Chatbotistic:

```
Paddle transaction.completed
  → POST https://<license-api>/webhooks/paddle        (signature-verified)
  → licenses.issue(product=chatbotistic, plan, customer email)
  → branded key email (welcome + key) via the mailer
```

Requirements for first live sale (learned on WPistic — see memory
`wpistic-paddle-platform-state`):

1. Paddle account needs a **default payment link** set in the dashboard
   (checkout-settings) — no API for this; without it every checkout 400s
   with `transaction_default_checkout_url_not_set`.
2. Live mode additionally needs completed onboarding (business
   verification + payout), and the checkout domain must be approved.
3. Webhook destination must be the signature-verified endpoint (a bare
   401-catching path silently loses sales).

## Transactional emails

| Email | Sent by | Status |
|---|---|---|
| Welcome + license key | WordPress `chatbotistic-profile` branded HTML suite | live |
| Purchase receipt | Paddle (automatic) | automatic |
| Billing / renewal / cancel | Paddle (automatic) | automatic |
| SaaS welcome sequence | `chatbotistic-profile` (`class-emails-automation.php`) | live |

All SaaS emails point at `app.chatbotistic.com` for dashboard links. The
provider API remains `services.tochat.be` and is never exposed with tenant
credentials in browser code.

## Customer widget plugin licensing

`chatbotistic-widget` (customer sites) activates against the WPistic public
SDK at `api.wpistic.com/api/v1/licenses/{activate,validate,deactivate}`
and calls `GET /api/v2/widgets` on the customer's own `services.tochat.be`
account. The license key and activation token are the credentials; caps
(`max_widgets`, `max_agents`, `max_domains`) arrive in the activation
response from the member's plan. Analytics and front-end rendering only use
the intersection of configured keys and the license-scoped widget catalog —
enforced in `class-analytics-page.php` and `class-widget-renderer.php` since
widget v1.4.0.
