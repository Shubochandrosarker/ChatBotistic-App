# Dashboard Bug Audit — 2026-07-11

Full-repo audit of `ChatBotistic-App` (package name `wpistic-whatsapp-crm`, the
codebase behind the "Chatbotistic Dashboard"), requested after the product
owner reported the dashboard as "not working." Method: `npm run typecheck` /
`npm run lint` / `npm test` (all pass — 0 typecheck errors, 0 lint errors/36
warnings, 37/37 vitest tests), plus a manual read-through of the app-router
pages, API routes, and lib code. No files were changed as part of this audit.

**Headline: nothing crashes the app outright.** The bugs below are real, but
they cluster in one place — **team collaboration inside a multi-user
organization** — because most of the code was written and tested against a
single-user org and the multi-tenant (`org_id`) migration (`009_org_tenancy.sql`)
wasn't fully threaded through every query.

---

## Breaks core flow

1. **Automations only fire for the user who connected WhatsApp — not the org.**
   `src/lib/automations/engine.ts:59` filters `automations` by
   `.eq('user_id', input.userId)`, where `input.userId` is always the owner of
   the `whatsapp_config` row. In an org with 2+ teammates, an automation built
   by teammate B never runs when teammate A is the one who connected
   WhatsApp. **Fix priority: high** — this silently breaks automations for
   any team account, with no error shown anywhere.

2. **A teammate's own automations 404 when opened.**
   The list route (`src/app/api/automations/route.ts:18-23`) correctly reads
   org-wide via RLS, but `GET/PATCH /api/automations/{id}` and
   `POST /api/automations/{id}/duplicate` (`src/app/api/automations/[id]/route.ts:30-39,60-67`,
   `.../duplicate/route.ts:21`) all re-filter by
   `.eq('user_id', user.id)` against the admin (service-role) client. A
   teammate sees an automation in the list, clicks it, and gets a 404.

3. **Teammates who didn't personally connect WhatsApp see "not connected" everywhere.**
   `whatsapp_config` is an org-scoped table (migration 009), but it's queried
   with `.eq('user_id', user.id)` in `src/app/(dashboard)/inbox/page.tsx:56`,
   `src/components/settings/whatsapp-config.tsx:101`, and the broadcast
   "new" flow. Any teammate other than the one who ran the setup wizard sees
   Inbox / Settings / Broadcasts all report "not connected" even though the
   org's WhatsApp number is live and messages are flowing. This is very
   likely part of what reads as "the dashboard is not working" if more than
   one person has logged into the account.

4. **Broadcasts can be built from unapproved templates.**
   `src/components/broadcasts/step1-choose-template.tsx:31-34` fetches
   `message_templates` with no `.eq('status', 'Approved')` filter (the
   inbox's picker does filter). A Draft/Rejected template can be selected,
   and the broadcast is only discovered to be broken when Meta rejects every
   send — no upfront warning.

## Data / tenant-isolation risk

5. **`/leads` and `/knowledge-base` aren't in the edge auth allowlist.**
   `src/proxy.ts:62-68` (the Next 16 replacement for `middleware.ts` —
   confirmed against `node_modules/next/dist/docs`, not a naming bug) lists
   `protectedPaths` for every dashboard route except these two. Auth still
   happens client-side and inside each API route, so no data currently
   leaks, but it's an inconsistent boundary — the next page added under
   either route that fetches data client-side without its own guard would
   be exposed at the edge.

6. **Settings → Tags/Templates go stale for non-owner teammates.**
   `src/components/settings/tag-manager.tsx:64` and
   `.../template-manager.tsx:121` still filter by `.eq('user_id', userId)`
   even though `tags`/`message_templates` became org-scoped. Every other
   consumer of the same tables (contacts page, broadcast audience picker,
   inbox template picker) correctly queries without a user filter. A
   teammate opening Settings sees an empty Tags/Templates list.

7. **Automation logs are reachable for a teammate's automation, editing isn't.**
   `src/app/(dashboard)/automations/[id]/logs/page.tsx:42` fetches via the
   org-wide RLS client (works), while edit/duplicate/delete on the same
   automation 404 via the admin-scoped routes in #2 — an inconsistent
   permission boundary inside one feature.

## UX papercuts

8. `src/components/inbox/contact-sidebar.tsx:87` (`handleAddNote`) has no
   session-expiry guard and swallows insert errors silently (no toast) —
   unlike the equivalent path in `contact-detail-view.tsx`. A note typed
   after the session expires looks saved but isn't.
9. `src/lib/automations/engine.ts:414-420` — the `assign_conversation` step's
   `round_robin` mode always resolves to the single profile matching
   `automation.user_id`; it never actually rotates across agents despite the
   option existing in the automation builder UI.
10. `src/components/contacts/contact-form.tsx:50` — the form-reset effect is
    missing `contactTags` from its dependency array (latent stale-closure
    risk; not currently triggered by any caller).

## Style nits

- One `as any` in `src/`: `src/components/marketing/reveal.tsx:54`.
- One stray `console.log(` in `src/`: `src/app/api/whatsapp/send/route.ts:275`.
- 36 ESLint warnings, mostly `react-hooks/set-state-in-effect`
  (`message-bubble.tsx:76`, `profile-form.tsx:54`, `tag-manager.tsx:50`,
  `template-manager.tsx:107`, `whatsapp-config.tsx:205`) and a few unused
  imports (`message-composer.tsx:16`, `message-thread.tsx:32`,
  `template-manager.tsx:13`) — cosmetic, worth a batch cleanup pass.

## Confirmed *not* bugs (checked explicitly because they looked suspicious)

- `CHATBOTISTIC_API_KEY` never reaches the browser — server-only module,
  called only from `src/app/api/leads/route.ts`.
- The Leads page correctly shows a "Chatbotistic not connected" state when
  the key is unset (`src/app/(dashboard)/leads/page.tsx:135-139`) rather than
  breaking.
- Signup → org provisioning → login → `/dashboard` redirect all work
  correctly end-to-end.
- Webhook routes (Meta / Twilio / SMS) are correctly signature/secret-gated
  and their admin-client queries are safely scoped by globally-unique
  provider message IDs.

## Root cause, in one sentence

Everything in "Breaks core flow" and "Data / tenant-isolation risk" traces
back to code written against `user_id` before the org-tenancy migration
landed, and never revisited. **Recommended fix:** add one shared helper
(e.g. `getOrgIdForUser(userId)` / a `requireOrgScope()` guard) and grep-replace
every remaining `.eq('user_id', ...)` on `automations`, `whatsapp_config`,
`tags`, and `message_templates` to filter by `org_id` instead, matching the
pattern already used correctly by the contacts and inbox-template-picker
code. This is a contained, mechanical fix — not a redesign.
