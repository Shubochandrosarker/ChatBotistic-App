# Repository Audit & Chatbotistic Rebrand — 2026-07-31

Full-repo audit of `chatbotistic-app`, plus the Chatbotistic branding
and design-system pass that came out of it.

**Supersedes** `dashboard-bug-audit-2026-07-11.md` and
`design-responsive-audit-2026-07-11.md` — see "Previously-reported
issues" below for the re-verification of every item in those two.

---

## Health check

Run against a clean `npm install` on Node 22.

| Check | Result |
| --- | --- |
| `npm run typecheck` | **pass** — 0 errors |
| `npm run lint` | **pass** — 0 errors, 44 warnings |
| `npm test` | **pass** — 78/78 (was 74; +4 added by this pass) |
| `npm run build` | **pass** — standalone output produced |

Nothing in the repository is broken. The findings below are real but
none of them stop the app from building, deploying, or running.

---

## Fixed in this pass

### 1. `font-mono` resolved to nothing — every monospace surface was falling back

`globals.css` mapped `--font-mono: var(--font-geist-mono)`, and
`--font-geist-mono` was **never defined anywhere in the repo**. Tailwind's
`font-mono` utility therefore emitted an empty `font-family`, so every
surface meant to be monospace was silently rendering in the body font:

- API keys and webhook URLs in Settings (`whatsapp-config.tsx`)
- the widget embed snippet (`embed-code-dialog.tsx`)
- automation webhook payload editors (`automation-builder.tsx`)
- broadcast variable tokens (`step3-personalize.tsx`)
- account/org IDs in the profile panel (`profile-form.tsx`)

Fixed by loading a real monospace face (JetBrains Mono) through
`next/font` and pointing the token at it. This is the kind of bug that
survives indefinitely because nothing errors — it just looks slightly
wrong forever.

### 2. Full phone numbers written to production logs

`src/app/api/whatsapp/send/route.ts:275` logged a contact's complete
phone number, before and after auto-correction, at `console.log` level.
Hosting log streams are retained, often shipped to third-party
aggregators, and readable by anyone with panel access — a much weaker
protection boundary than the `contacts` table those numbers live in.

Now masked to the last four digits via a new `maskPhone()` in
`phone-utils.ts` (covered by 4 new tests), which keeps the line useful
for debugging without putting PII in the log.

### 3. `localStorage` keys renamed without dropping user state

The rebrand renames three browser-storage keys. Done naively this
would have silently reset every existing user — dark-theme users
flipped back to light, the onboarding checklist reappearing on
established orgs, every notification re-marked unseen.

`src/lib/storage-keys.ts` now does a write-through migration: reads
fall back to the `wpistic-` key once, copy the value forward, and
delete the old one. The pre-paint inline theme script in
`theme-provider.tsx` carries the same fallback itself — without it,
returning dark-mode users would get exactly the one-frame light flash
that script exists to prevent.

---

## Open findings (not fixed — flagged for a decision)

### A. Marketing site and `/docs` are still WPistic-branded

Out of scope for this pass by explicit request. `src/app/(marketing)/`,
`src/components/marketing/nav.tsx`, and `footer.tsx` still read
"WPistic WhatsApp CRM" and the API docs use `chatbot.wpistic.cloud` as
the example origin. The app and the public site now disagree about the
product's name, which is worth closing before the next public release.

### B. Live hostnames and contact addresses still on the `wpistic` domain

Deliberately left alone — these are real infrastructure, not copy, and
changing them in docs without changing DNS would make the docs wrong:

- `DEPLOY.md` — `chatbot.wpistic.cloud` (6 references)
- `.github/SECURITY.md` — `security@wpistic.com`
- `next.config.ts` / `.env.local.example` — `NEXT_PUBLIC_SITE_URL`
  default

Needs a product decision on whether the deployment moves to a
`chatbotistic` hostname.

### C. `MetricDelta.previous` means two different things

`src/lib/dashboard/types.ts` — for `newContactsToday` and
`messagesSentToday`, `previous` holds yesterday's raw count and the
grid computes `current - previous`. For `activeConversations` it holds
a **pre-computed delta** and the grid passes it straight through
(`metrics-grid.tsx:22`). Both are currently correct, so this is not a
live bug — but one field name carrying two meanings is a trap for the
next person who adds a metric. Worth splitting into `previous` vs
`delta`.

### D. 14 npm advisories (2 low, 5 moderate, 7 high)

The 7 highs are all `sharp` → `libvips` (CVE-2026-33327/33328/35590/35591),
reached only as a transitive dependency of `next`. `npm audit fix --force`
resolves them by moving to `next@16.2.12`, which is outside the stated
`16.2.4` range — a deliberate version bump, not a patch, so it should be
its own change with its own build verification.

### E. 44 ESLint warnings

Almost entirely `react-hooks/set-state-in-effect` plus a few React
Compiler memoization notes. Cosmetic and non-blocking, but they make
real warnings hard to spot. Worth a dedicated cleanup pass.

### F. One `as any`

`src/components/marketing/reveal.tsx:54` — a polymorphic `ref` cast.
Contained and already annotated with an eslint-disable.

### G. `npm run format:check` has never passed

226 files fail it — verified identical on a clean checkout with all of
this pass's changes stashed, so it is not a regression. The cause is
that `.prettierrc` sets `"singleQuote": true` while most of the
codebase is written with double quotes.

Deliberately left alone: `npm run format` would rewrite essentially
every file in the repo and bury any real change under a whole-tree
diff. CI does not gate on it (`ci.yml` runs lint, typecheck, test,
build). Fixing it means one dedicated formatting-only commit — and
first a decision on whether the config or the code is the thing that
should change.

---

## Previously-reported issues — re-verified

Every item from the 2026-07-11 audits was re-checked against current
`main`. **All ten dashboard bugs and both design bugs are fixed**; the
old docs are stale, not accurate.

| # | Issue (2026-07-11) | Status now |
| --- | --- | --- |
| 1 | Automations engine filtered by `user_id` | **Fixed** — `engine.ts:73` filters `org_id` |
| 2 | Teammate's automations 404 on open | **Fixed** — `[id]/route.ts:41,71` scope by `org_id` |
| 3 | `whatsapp_config` queried per-user | **Fixed** — org-scoped via RLS, comments added |
| 4 | Broadcasts from unapproved templates | **Fixed** — `.eq('status','Approved')` present |
| 5 | `/leads`, `/knowledge-base` off the auth allowlist | **Fixed** — both in `proxy.ts` `protectedPaths` |
| 6 | Settings Tags/Templates stale for teammates | **Fixed** — user filter removed |
| 7 | Automation logs/edit permission mismatch | **Fixed** — resolved with #2 |
| 8 | `handleAddNote` swallowed errors | **Fixed** |
| 9 | `round_robin` never rotated agents | **Fixed** — `pickRoundRobinAgent` reads `org_members` |
| 10 | `contact-form` missing dep | **Fixed** |
| — | Theme hydration flash | **Fixed** — single `useLayoutEffect` pass |
| — | Base UI `nativeButton` warning | **Fixed** |
| — | "Rebrand 0% done" | **Done for the app** — see A for the marketing site |

---

## The rebrand

### Color

The palette moves from WPistic violet-on-lavender to Chatbotistic
green-on-obsidian, per the `whatsapp-premium` direction.

Light mode sits a deep green (`oklch(0.53 0.132 162)`, `#008253`) on a
barely-tinted off-white. That green is deliberately dark: it is the
*lightest* it can be while still clearing 4.5:1 under white button
text. A brighter, more literal "WhatsApp green" fails that badly and
would have forced dark text on primary buttons.

Dark mode inverts the relationship — a bright mint primary with
near-black text — on an obsidian canvas pulled slightly green so it
belongs to the brand family rather than reading as generic charcoal.

Every foreground/background pair was checked programmatically against
WCAG AA before being committed: 13 pairs per theme for text and UI, and
all 5 chart series against their card at 3:1. All pass. Two things were
tuned specifically because the check failed them first:

- `--success` sits at a **leafier hue** (145) than the brand green
  (162), so a "delivered" badge doesn't read as a brand chip.
- Large brand panels use their own `--brand-surface-*` tokens rather
  than `--primary`. Reusing the dark primary made the auth panel a
  glaring half-screen mint slab; panels get a deep forest green
  instead. Small fills (the logo tile) keep the bright primary, which
  is what it's tuned for.

### Type

`"Segoe UI"` / `"Trebuchet MS"` — the single biggest contributor to the
generic look — are replaced with Inter (interface), Plus Jakarta Sans
(headings), and JetBrains Mono (code), self-hosted via `next/font`, so
there is no external request at runtime and no layout shift.

### Identity

The mark — a monoline speech bubble with a four-point spark, drawn in
code at `src/components/brand/logo.tsx` — carries "conversation + AI"
in one shape, scales without an asset, and recolors with the theme. It
drives the sidebar, the favicon (`icon.tsx`, redrawn filled so it holds
up at 32px), the iOS/PWA icon (`apple-icon.tsx`, new), and the PWA
manifest.

### Structure

The sidebar's flat ten-link list is now grouped — Overview,
Conversations, Campaigns, Chatbot — mirroring how the product actually
splits. Ten undifferentiated rows forced a full read every time.

Auth pages moved to a shared branded split shell
(`src/components/brand/auth-shell.tsx`) instead of three independently
styled centered cards.

The dashboard KPI chips, activity badges, quick actions, and both
charts were moved off hardcoded Tailwind palette colors (`#7c3aed`,
`violet-500`, `blue-400`) onto the `--chart-*` tokens. Besides being
on-brand, this fixes a real contrast problem: `text-*-400` shades on a
white card were landing around 2.5:1.

### Verified

Rendered and screenshotted at 1440×900 and 390×844, light and dark:
no horizontal overflow at any size, `Inter` and `JetBrains Mono` both
resolving, and no console errors beyond dev-only HMR noise.
