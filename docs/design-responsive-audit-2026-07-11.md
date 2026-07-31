> **Superseded by [`audit-and-rebrand-2026-07-31.md`](./audit-and-rebrand-2026-07-31.md).**
> The theme-hydration flash and the Base UI `nativeButton` warning are
> fixed, and the Chatbotistic rebrand has since landed for the app
> (the marketing site is still outstanding). Kept for history.

# Design & Responsive Audit — 2026-07-11

Live runtime audit of the marketing/docs surface (`/`, `/docs`, `/login`,
`/signup` — the routes reachable without a Supabase session) at four
viewports (375×812, 768×1024, 1024×768, 1440×900), using a headless
Chromium against the local dev server. Full screenshot set is in
`/tmp/claude-0/.../scratchpad/audit-screenshots/` from the audit run (not
committed — regenerate with the same script if you want fresh evidence).

## Root cause: "dark toggle button not working"

This is real and reproducible (3/3 trials), but it's not the toggle — it's a
**hydration ordering bug that fires on every page load**, not just when the
toggle is clicked.

`src/components/theme-provider.tsx`:
- The inline anti-flash script in `src/app/layout.tsx:45` runs before paint
  and correctly sets the `dark` class on `<html>` from `localStorage`. This
  part is fine — no flash on the very first paint.
- But `ThemeProvider`'s React state always **initializes to `"light"`**
  (`theme-provider.tsx:50`), regardless of what's actually stored. On
  hydration, the effect at lines 68–73 runs immediately with that wrong
  default and calls `applyTheme("light")`, which **removes** the `dark`
  class the inline script just added. Only afterwards does the separate
  effect at lines 55–63 read `localStorage`, update state to `"dark"`, and
  re-trigger `applyTheme("dark")`.

Net effect, measured via a `MutationObserver` on `document.documentElement`
with `localStorage['wpistic-theme'] = 'dark'`:

```
Run 1: t=460ms  dark → false   t=1088ms  false → true
Run 2: t=443ms  dark → false   t=882ms   false → true
Run 3: t=440ms  dark → false   t=1208ms  false → true
```

So on every reload, a user who chose Dark sees the page **flash back to
light for 400–750ms** before self-correcting. That reads exactly like "the
dark toggle doesn't work," especially on a slower connection/device where
the window is wider.

**Fix:** initialize `theme`/`resolvedTheme` state by reading `localStorage`
synchronously in `useState`'s initializer (matching what the inline script
already does), instead of hardcoding `"light"` and correcting one effect
tick later. The toggle's click behavior itself is correct — clicking
Light/System/Dark updates `aria-checked`, `localStorage`, and the `dark`
class immediately and reliably, including on the mobile header where it
sits next to the hamburger menu (no overlap, rapid-click safe, System mode
correctly follows live OS `prefers-color-scheme` changes).

## Other confirmed issues

### Medium — Base UI accessibility warning, every marketing page

```
Base UI: A component that acts as a button expected a native <button>
because the `nativeButton` prop is true. Rendering a non-<button> removes
native button semantics... Use a real <button> in the `render` prop, or set
`nativeButton` to `false`.
```

Fires 6× on `/`, 2× on `/docs` (0 on `/login` and `/signup`). Source:
`Button` composed with `render={<Link .../>}` in
`src/components/marketing/nav.tsx` and the landing-page CTAs — `Button`
defaults `nativeButton` to `true` but is asked to render an `<a>`. This is
a real semantics/accessibility gap (keyboard and assistive-tech behavior
differs from an actual `<button>`), and it's also what's populating the
Next.js dev-overlay's red issue badge (up to "6 Issues") visible on nearly
every screenshot of the site — worth fixing if that badge is what looked
like "docs page not working properly" during a quick look at the site with
dev tools open. **Fix:** pass `nativeButton={false}` on every `Button`
instance that renders a `Link`/`<a>`.

### Medium — Rebrand to "Chatbotistic" is 0% done, not partial

Every visible brand surface — nav logo, page `<title>`, hero H1, `/docs` H1,
footer — still reads **"WPistic WhatsApp CRM."** "Chatbotistic" appears
exactly once on the whole marketing site, as a third-party integration
listed in the landing page's integrations grid. If what's expected is a
site that says "Chatbotistic Dashboard," this hasn't been started —
worth flagging as its own task rather than a "bug," since it's copy/branding
work, not a defect.

### Confirmed non-issues (checked because they looked plausible, turned out fine)

- **No horizontal overflow** on any of the 16 page × viewport combinations
  tested (`document.documentElement.scrollWidth === window.innerWidth`
  everywhere).
- **`/docs` has a working mobile nav.** `DocsNav` renders a
  horizontally-scrollable sticky chip bar below the `lg` breakpoint — there
  is a way to jump between sections on mobile, contrary to what the
  sidebar-only desktop layout might suggest at a glance.
- **Code blocks / tables scroll correctly** on narrow viewports without
  breaking page width.
- Screenshots that initially looked like "blank sections" on the home page
  were a scroll-triggered fade-in animation racing ahead of an automated
  full-page screenshot, not a real rendering bug — confirmed by re-capturing
  with the page manually scrolled and settled.
- One Turbopack dev-server crash was observed once under CPU throttling
  during testing ("Next.js package not found" workspace-root inference
  error) — dev-tooling flakiness, unrelated to the product, resolved by
  restarting `npm run dev`.

## Priority order

1. Theme-provider hydration fix (root cause of the reported dark-mode bug —
   small, contained change to `theme-provider.tsx`).
2. `nativeButton={false}` pass on marketing `Button`+`Link` compositions
   (accessibility + removes the visible dev-overlay error badge).
3. Chatbotistic rebrand pass across marketing copy, `<title>`, and the
   `/docs` page — scope this as its own task since it touches many files.
