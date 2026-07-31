# Configuring Cloudflare Workers AI

Workers AI powers two things in Chatbotistic:

- **Knowledge Base embeddings** — documents added at `/knowledge-base`
  are chunked and embedded so the chatbot can retrieve them.
- **The "AI Reply" automation step** — retrieves the closest chunks and
  writes a reply.

Until it is configured, `/knowledge-base` shows a warning banner,
documents cannot be embedded, and the AI Reply step skips sending.

Two environment variables are required. Both are **server-only** — they
are read in `src/lib/ai/cloudflare.ts`, which is never bundled into the
browser. Do not prefix them with `NEXT_PUBLIC_`.

---

## Step 1 — Get your account ID

1. Sign in at <https://dash.cloudflare.com>.
2. Pick any site, or open **Workers & Pages**.
3. Copy **Account ID** from the right-hand sidebar. It is a 32-character
   hex string.

This is `CLOUDFLARE_ACCOUNT_ID`.

## Step 2 — Create an API token

1. Go to <https://dash.cloudflare.com/profile/api-tokens>.
2. **Create Token** → **Create Custom Token**.
3. Configure it as narrowly as possible:

   | Field | Value |
   | --- | --- |
   | Token name | `chatbotistic-workers-ai` |
   | Permissions | **Account** · **Workers AI** · **Read** |
   | Account Resources | Include · *your account* |
   | TTL | leave unset, or set an expiry you will actually rotate |

   `Workers AI · Read` is the only permission needed. The app calls
   `POST /accounts/{id}/ai/run/{model}` for inference — that is covered
   by Read. Do not grant Edit, and do not use a Global API Key: it
   carries full account access and cannot be scoped or revoked
   independently.

4. **Continue to summary** → **Create Token**, then copy the value.
   Cloudflare shows it exactly once.

This is `CLOUDFLARE_API_TOKEN`.

## Step 3 — Verify the token before wiring it in

Worth doing — it separates "the token is wrong" from "the app is wrong":

```bash
curl -s https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/baai/bge-base-en-v1.5 \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":["hello"]}' | head -c 400
```

Expect `"success":true` and a long `data` array of floats. If you get
`"code":10000` the token lacks Workers AI permission; if you get a 404
the account ID is wrong.

## Step 4 — Set them where the app runs

Local development — add to `.env.local` (gitignored):

```bash
CLOUDFLARE_ACCOUNT_ID=your-32-char-account-id
CLOUDFLARE_API_TOKEN=your-workers-ai-token
```

Hostinger hPanel (per [`DEPLOY.md`](../DEPLOY.md)) — add both under the
Node.js app's **Environment variables**, then **restart** the app.

Unlike the `NEXT_PUBLIC_SUPABASE_*` values, these two are read at
**runtime**, not baked in at build time. A restart is enough; you do not
need to rebuild.

## Step 5 — Confirm the database side

Embeddings are stored in Postgres via pgvector, not by Cloudflare.
Migration `011_ai_knowledge_base.sql` creates the extension, the
`ai_knowledge_base` table, an HNSW index, and the `match_kb_chunks()`
retrieval function. If it has not been applied, embedding will fail even
with a valid token:

```sql
-- against your Supabase database
select extname from pg_extension where extname = 'vector';
select to_regclass('public.ai_knowledge_base');
```

Both should return a row.

## Optional model overrides

| Variable | Default | Notes |
| --- | --- | --- |
| `CLOUDFLARE_AI_EMBEDDING_MODEL` | `@cf/baai/bge-base-en-v1.5` | **768 dimensions.** Migration 011 declares `vector(768)`. Switching to a model with a different width requires a migration to match, or every insert fails. |
| `CLOUDFLARE_AI_CHAT_MODEL` | `@cf/meta/llama-3.1-8b-instruct` | Free to change; no schema impact. |

## Cost

Workers AI bills per neuron and includes a daily free allocation.
Embedding is cheap — a document is embedded once, then reused for every
retrieval. Chat generation dominates. Current pricing:
<https://developers.cloudflare.com/workers-ai/platform/pricing/>

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Banner still shows after setting the vars | App not restarted, or the vars were set on the wrong service. |
| `CLOUDFLARE_ACCOUNT_ID is not set` in logs | Variable missing at runtime — check for a typo or a `NEXT_PUBLIC_` prefix. |
| `10000: Authentication error` | Token lacks **Workers AI · Read**, or was revoked. |
| Embeddings save but retrieval finds nothing | Migration 011 not applied, or documents were added before the token was configured — re-save them to embed. |
| `expected 768 dimensions` | Embedding model overridden with a different width. Revert, or migrate the column. |
