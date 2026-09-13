# In-dashboard help bubble

A floating assistant in the bottom-right of every signed-in dashboard
page, backed by the WPISTIC AI worker at
[chat.wpistic.cloud](https://chat.wpistic.cloud).

- UI: `src/components/support/support-bubble.tsx`
- Transport: `src/lib/support-chat.ts`
- Mounted in: `src/app/(dashboard)/dashboard-shell.tsx`, inside the auth
  gate, so it never renders for a signed-out visitor.

## Why it is not an iframe

Three reasons, in order of how hard they block:

1. **The worker forbids framing.** `src/http.ts` in
   `llm-chat-app-template` sends `frame-ancestors 'none'` in its CSP and
   `x-frame-options: DENY` on every response. A browser will refuse to
   render it in an iframe. This is not a config toggle — it is a code
   change in that repo.
2. **It would put a storefront inside a paid product.** The public
   assistant sells fixed-price agents through Stripe and carries
   Hostinger promotional links. Framing it as-is means a customer who is
   already paying, and who opened the bubble to ask why a broadcast
   failed, gets shown a "$9 Business Model Architect" card.
3. **It could not be styled.** An iframe keeps WPISTIC AI's own fonts and
   colours, so the panel would visibly not belong to the dashboard.

Calling the API directly and owning the UI here costs one small fetch
client and avoids all three.

## What still needs changing in `llm-chat-app-template`

The bubble is built and will work the moment these two land. Until then
it degrades to static help links rather than showing a broken chat — but
**it cannot talk to the worker yet.**

### 1. Allow the dashboard origin through CORS — required

`src/http.ts`, `allowedOrigins()`:

```ts
const list = [
	"http://localhost:8787",
	"http://127.0.0.1:8787",
	"https://chat.wpistic.cloud",
	"https://app.chatbotistic.com", // ← the dashboard
];
```

Without this the browser blocks the preflight and every message fails.
That is the single blocking change.

### 2. Add a support mode — recommended

The bubble already refuses to render the paid-agent card: it ignores the
`x-wpistic-agent` response header entirely. But the offer is also
injected into the system prompt (`selectOffer` → `buildSystemPrompt` in
`src/index.ts`), so the model can still pitch in prose. Suppressing that
needs a worker-side flag — for example, honour a `support: true` field on
the `/api/chat` body and skip `selectOffer` when it is set:

```ts
const isSupport = body.support === true;
const offer = isSupport ? null : selectOffer(messages, intent);
```

`streamSupportReply` in `src/lib/support-chat.ts` is where you would add
that field once the worker accepts it.

### 3. Consider a Chatbotistic-aware prompt — worth thinking about

`buildSystemPrompt` describes a **business-advice** assistant: audits,
SEO, speed, conversion, business-model planning. It knows nothing about
Chatbotistic accounts, WhatsApp provider setup, broadcast template
approval, or the automation builder.

So the bubble will answer "how do I connect my WhatsApp number?" from
general knowledge rather than from your product. It will sound
confident and be wrong often enough to generate support load rather than
absorb it.

Options, roughly in order of effort:

- Add a product-support branch to the worker's prompt covering the setup
  flows, and route `support: true` sessions to it.
- Point the bubble at the CRM's own Knowledge Base instead — there is
  already a RAG pipeline at `/api/ai/knowledge-base` with Workers AI
  embeddings, and it is fed by documents you control. This is the better
  long-term answer, and it is the reason the Cloudflare setup in
  `docs/cloudflare-workers-ai.md` matters.
- Ship as-is and treat the bubble as a general assistant, with the docs
  link doing the product-specific work.

**Recommendation:** do (1) so it works, do (2) so it does not upsell
paying customers, and treat (3) as the follow-up that decides whether
this bubble is genuinely useful or just present.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPPORT_CHAT_URL` | `https://chat.wpistic.cloud` | Worker origin the bubble talks to. |
| `NEXT_PUBLIC_SUPPORT_BUBBLE` | unset (shown) | Set to `0` to hide the bubble entirely. |

Both are `NEXT_PUBLIC_*`, so they are baked in at build time — changing
either needs a rebuild and redeploy, not just a restart.

## Behaviour

- Enter sends, Shift+Enter inserts a newline.
- Escape closes the panel and returns focus to the launcher.
- Full-width sheet below `sm`, anchored 380px card above it.
- Closing mid-reply aborts the stream rather than leaving it running.
- Any transport failure — CORS, offline, rate limit, 5xx — drops to the
  fallback panel with a docs link and a link to open the assistant in a
  new tab. It never shows a raw error.
