# Billing, checkout, emails & licenses — the full chain

This is the complete money→license→email pipeline for Chatbotistic, so
every surface (marketing site, CRM app, WordPress SaaS site, customer
widget plugin) can be wired consistently.

## Domains (canonical)

| Domain | Role |
|---|---|
| `www.chatbotistic.com` | Marketing + WordPress SaaS (Memberistic + Licenseistic + the four connector plugins) |
| `app.chatbotistic.com` | White-label API host (CNAME → services.tochat.be). API + widget loader only — never hosts the dashboard |
| `crm.chatbotistic.com` | This app (the custom dashboard/CRM) |

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
2. **Paddle overlay (this app, `/pricing`):** env-driven, one build
   serves sandbox and live.
   - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` — Paddle client token
   - `NEXT_PUBLIC_PADDLE_ENV` — `sandbox` (default) | `live`
   - `PADDLE_PRICE_FREE` / `PADDLE_PRICE_STARTER` / `PADDLE_PRICE_GROWTH` /
     `PADDLE_PRICE_AGENCY` — server-side price IDs read at request time
   - Buttons degrade to disabled with a tooltip when a price ID is unset.

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

All SaaS emails point at `crm.chatbotistic.com` for dashboard links
(repointed in connector v3.3.0 / profile v1.3.5).

## Customer widget plugin licensing

`chatbotistic-widget` (customer sites) activates against
`chatbotistic.com/wp-json/licenseistic/v1/{activate,heartbeat,deactivate}`
+ `GET /widgets` — the license key is the credential; caps
(`max_widgets`, `max_agents`, `max_domains`) arrive in the activation
response from the member's plan. Analytics only ever query widgets in
the site's allowed set (configured keys + license catalog) — enforced
in `class-analytics-page.php` since widget v1.3.0.
