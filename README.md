# WPistic WhatsApp CRM

> Multi-tenant WhatsApp CRM SaaS — shared inbox, contacts, sales
> pipelines, broadcasts, and no-code automations. Dual-provider
> messaging (Meta Cloud API + Twilio), org-scoped tenancy, and
> Memberistic/Licenseistic SSO gating.

[![CI](https://github.com/shubochandrosarker/WPistic-WhatsApp-CRM/actions/workflows/ci.yml/badge.svg)](https://github.com/shubochandrosarker/WPistic-WhatsApp-CRM/actions/workflows/ci.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ecf8e?logo=supabase)](https://supabase.com)

WPistic WhatsApp CRM derives from the open-source
[wacrm](https://github.com/ArnasDon/wacrm) template (MIT) and extends
it into a commercial multi-tenant SaaS.

## What you get

- **Shared inbox** — multiple agents working one WhatsApp number,
  per-conversation assignment, status, and notes.
- **Dual-provider messaging** — every org chooses **Meta Cloud API**
  (official WhatsApp Business API) or **Twilio** as its WhatsApp
  provider. The CRM speaks a single internal interface; the provider
  is swappable per org.
- **Contacts + tags + custom fields**, CSV import, deduplication.
- **Sales pipelines** (Kanban) with deals linked to conversations.
- **Broadcasts** with approved templates, delivery + read tracking,
  per-recipient variable substitution.
- **No-code automations** — triggers on inbound messages, new
  contacts, keywords, or schedule; conditional branches, waits, tags,
  webhooks. Visual builder.
- **Real-time dashboard** — response times, daily volume, pipeline
  value, cross-module activity feed.

## WordPressistic ecosystem

WPistic WhatsApp CRM is one product in the WordPressistic family and
stays a **separate codebase** from the Chatbotistic products:

- **Chatbotistic** (`ChatBotistic-Complete-System-Management`) — the
  chatbotistic.com website, membership/licensing chain, and the
  standalone **Chatbotistic Dashboard** (`chatbotistic-dashboard/`,
  dashboard.chatbotistic.com) for widget, landing-page, lead, and
  campaign management.
- **Chatbotistic SaaS Connector** (`chatbotistic-saas-connector`) —
  the distribution repo for the WordPress connector plugin stack.

This CRM's architecture (org tenancy + RLS, HMAC SSO bridge,
provider-strategy messaging layer, encrypted credentials) served as
the reference design for the Chatbotistic Dashboard, but no code is
shared between the repos — each evolves independently.

## Multi-tenancy

Every row in the database is scoped to an `org_id`. Users belong to
one or more organizations through the `org_members` table, and Row
Level Security enforces that members only ever see their own org's
data. See `supabase/migrations/009_org_tenancy.sql`.

## SSO bridge (Memberistic + Licenseistic)

Access to the CRM is gated by two WordPress plugins:

- **Memberistic** — owns memberships and plans.
- **Licenseistic** — owns the license key, allowed domains, and
  widget/agent/domain limits.

On the WordPress side the plugins mint a signed SSO token. WPistic CRM
verifies it (`src/lib/sso/`), provisions or maps the org, and stores
the asserted entitlements (agent cap, widget cap, allowed domains) on
the org record. The `/api/sso/login` route is the entry point.

## Stack

- **App** — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- **Data** — Supabase (Postgres + Auth + Storage + RLS).
- **WhatsApp** — Meta Cloud API and/or Twilio, selectable per org.

## Quick start

```bash
git clone https://github.com/shubochandrosarker/WPistic-WhatsApp-CRM.git
cd WPistic-WhatsApp-CRM
npm install
cp .env.local.example .env.local   # fill in Supabase + provider creds
npm run dev
```

Open <http://localhost:3000>.

## Dev loop

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000. |
| `npm run build` | Production build + standalone asset copy. |
| `npm run start:standalone` | Run the standalone production server locally. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run format` | Prettier write. |

## Deployment

The app builds to a self-contained Next.js **standalone** server
(`output: "standalone"`), so `npm run build` produces a ready-to-run
`.next/standalone/` directory. This deploys directly to Hostinger's
hPanel Node.js app feature — see [`DEPLOY.md`](./DEPLOY.md) for the
step-by-step guide. The same build runs under PM2 on a VPS.

## License

See [`LICENSE`](./LICENSE). This project derives from the MIT-licensed
wacrm template; the original copyright notice is retained.
