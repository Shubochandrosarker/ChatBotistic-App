# Widget Studio — Manual Test Checklist

Widget Studio (Widgets, Agents, FAQ groups, Booking configs — PRs #50–#53)
was built and verified with typecheck/lint/tests/build and a handful of
unauthenticated live checks (redirects, 401s, docs rendering), but **no one
has clicked through the authenticated UI with real data yet.** This sandbox
has no way to create a test account without touching the project's real
Supabase instance, so this checklist is for a manual pass against the real
deployed app.

Run through it in order — later sections assume the resources created in
earlier ones still exist.

## 0. Prerequisites

- [ ] `TOCHAT_API_EMAIL` and `TOCHAT_API_PASSWORD` are set in the deployment
      environment (the master Tochat.be account credentials — same ones the
      WordPress connector plugin uses).
- [ ] You're logged into the dashboard with an account that belongs to an
      org (sign up or SSO in normally).
- [ ] Open the browser console before starting — watch for errors on every
      page/action below, not just visibly broken UI.

## 1. Widgets (`/widgets`)

- [ ] Page loads without a "Tochat.be not connected" empty state (confirms
      env vars are picked up).
- [ ] **Create**: click "New Widget" → fill in Name (required) + at least
      one field per tab (General, Appearance, Messages, Banner, Landing
      page, Legal & cookies) → Create. Confirm it appears in the list.
- [ ] **Live preview** (desktop width, ≥1024px): while the create dialog is
      open, change the brand color, position (left/right), and greeting
      message — the preview panel on the right should update immediately.
      Click the preview's launcher bubble to toggle the expanded panel.
- [ ] **Preview hidden on mobile**: narrow the browser below 1024px width —
      the preview panel should disappear, not overflow or break layout.
- [ ] **Edit**: open the widget you just created, change a field in each
      tab, Save. Reopen it — confirm every change persisted (not just the
      last tab you touched).
- [ ] **Activate/pause toggle**: flip the switch on the widget card. Confirm
      the label updates (Active/Paused) and it survives a page refresh. If
      the request fails, confirm the switch visually reverts (optimistic
      rollback).
- [ ] **Embed code**: open "Get embed code" from the card's menu. Confirm
      the script tag shows a real widget id (not a placeholder), the copy
      button works (paste it somewhere to check), and the WordPress/GTM/
      plain-HTML instructions render.
- [ ] **Delete**: delete the widget, confirm the dialog warns about the
      embedded chat button disappearing, confirm it's removed from the list
      after confirming.

## 2. Agents (`/agents`)

- [ ] With zero widgets, "New Agent" is disabled and the empty state says
      to create a widget first. Create a widget, then confirm the button
      enables and the empty state changes.
- [ ] **Create**: New Agent → fill Name, WhatsApp number, pick a Widget from
      the dropdown, optionally job title/greeting/icon → Create. Confirm it
      appears with the correct widget name shown on the card.
- [ ] **Edit**: change the widget an agent is attached to (if you have 2+
      widgets) — confirm it saves and the card updates to show the new
      widget's name.
- [ ] **Delete**: confirm the dialog, confirm removal from the list.

## 3. FAQ groups (per agent, "Manage FAQs")

- [ ] Open "Manage FAQs" on an agent with none yet — confirm the empty
      state, not a blank/broken panel.
- [ ] **Create**: New FAQ group → title + at least 2 questions (use "Add
      question" to add a row, remove one with the X). Save. Confirm it
      appears in the list with the right question count.
- [ ] **Edit**: reopen the group, add a third question, change the title,
      save. Reopen again — confirm all 3 questions and the new title
      persisted.
- [ ] **Delete**: confirm removal.
- [ ] Close and reopen the whole "Manage FAQs" dialog on a *different*
      agent — confirm it shows that agent's groups, not a stale list from
      the previous agent.

## 4. Booking configs (per agent, "Manage Bookings")

- [ ] **Create**: New booking config → set a start/end date, slot length,
      timezone. In the weekly-availability builder: give Monday **two**
      separate windows (e.g. 09:00–13:00 and 14:00–18:00, a lunch-break
      split) and leave Sunday closed (no windows). Add one blocked date.
      Save.
- [ ] Confirm the list card shows the right date range, slot count, and
      window count.
- [ ] **Edit**: reopen it — confirm Monday still shows both windows in the
      right order, Sunday is still closed, and the blocked date is still
      there. Remove one Monday window, add a Tuesday window, save. Reopen
      once more to confirm the change stuck.
- [ ] **Reminders**: toggle the three reminder switches off, save, reopen,
      confirm they stayed off.
- [ ] **Delete**: confirm removal.

## 5. Tenant isolation (if you have a second org/account available)

This is the highest-stakes thing to verify — Tochat.be is one shared master
account across every org on this platform, so the app-layer ownership
checks are the *only* thing preventing cross-tenant access.

- [ ] Log in as Org A, create a widget, note its id (visible in the embed
      code dialog or the network tab).
- [ ] Log in as Org B. Confirm Org A's widget does **not** appear in Org
      B's `/widgets` list.
- [ ] While logged in as Org B, manually hit `GET /api/tochat/widgets/{Org
      A's widget id}` (e.g. via the browser devtools network tab or curl
      with Org B's session cookie). Confirm it returns **404**, not Org A's
      data.
- [ ] Same check one level down: try `GET /api/tochat/operators/{an Org A
      agent's id}` and `GET /api/tochat/faq-groups/{an Org A FAQ group's
      id}` as Org B — both should 404.

## 6. Regression check on the rest of the app

Widget Studio touched shared files (`proxy.ts`, the sidebar nav). Quick
sanity pass:

- [ ] Sidebar shows Widgets and Agents in the nav, both navigate correctly,
      active-state highlighting works.
- [ ] Existing pages (Dashboard, Inbox, Contacts, Automations, Settings)
      still load normally — nothing broke in `proxy.ts`'s auth routing.
- [ ] `/docs` — the four new sections (Tochat widgets, Tochat agents, Tochat
      FAQ groups, Tochat booking configs) are all present and their nav
      links jump to the right place, on both desktop and mobile.

## If something fails

Note the exact step, what you expected vs. what happened, and any console
errors — that's enough for a fast, targeted fix rather than another blind
pass.
