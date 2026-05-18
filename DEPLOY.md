# Deploying to Hostinger (hPanel Node.js app)

This app is built for Hostinger's **hPanel "Node.js app"** feature. The
`next.config.ts` sets `output: "standalone"`, so `next build` produces a
self-contained server at `.next/standalone/` — exactly the single
startup file hPanel's Passenger runtime expects, with a minimal traced
`node_modules` and no need for the `next` CLI on the server.

## How the build is laid out

`npm run build` runs two steps:

1. `next build` — produces `.next/standalone/server.js` plus a traced
   `node_modules/` and a minimal `package.json`.
2. `node scripts/copy-standalone-assets.mjs` — copies `public/` and
   `.next/static/` into `.next/standalone/` (the standalone server does
   not bundle them because Next assumes a CDN; hPanel has none).

After a build, **everything inside `.next/standalone/` is the complete
deployable app**:

```
.next/standalone/
├── server.js          ← hPanel "Application startup file"
├── package.json       ← minimal, generated — do NOT npm install over it
├── node_modules/      ← traced, only what the routes need
├── public/            ← copied in by the post-build script
└── .next/
    ├── static/        ← copied in by the post-build script
    └── ...            ← server chunks
```

## 1. Build the app

Build **locally or in CI**, not on the shared host — a Next build can
exceed the RAM of an entry-level plan.

Public env vars (`NEXT_PUBLIC_*`) are inlined into the client bundle at
**build time**, so they must be set before you build. Put the
production values in `.env.local` (copy `.env.local.example`) or export
them:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
NEXT_PUBLIC_SITE_URL=https://crm.example.com \
npm run build
```

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`,
`META_APP_SECRET`, `SSO_SHARED_SECRET`, …) are read at **runtime** — do
not bake them in; set them in hPanel (step 4).

## 2. Create the Node.js app in hPanel

In hPanel: **Websites → your domain → Advanced → Node.js** (labelled
"Setup Node.js App" on some plans). Create an application:

| Field                   | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Node.js version         | 20 or 22 (the app requires `>=20`)                 |
| Application root         | a folder under your domain, e.g. `crm`             |
| Application URL          | the domain/subdomain to serve from                 |
| Application startup file | `server.js`                                        |

## 3. Upload the build

Upload the **contents of `.next/standalone/`** (not the folder itself)
into the Application root you chose above, via the hPanel File Manager,
SFTP, or SSH `rsync`. The root must end up containing `server.js`,
`node_modules/`, `public/`, and `.next/`.

**Do not run "Run NPM Install"** in the Node.js app panel. The
standalone `node_modules/` is already complete and traced; installing
over the generated minimal `package.json` will break it.

## 4. Set environment variables

In the Node.js app panel, add every variable your deployment needs (see
`.env.local.example` for the full list and which are required):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `META_APP_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- Optional: `AUTOMATION_CRON_SECRET`, `TWILIO_AUTH_TOKEN`,
  `SSO_SHARED_SECRET`, `WORDPRESS_SSO_URL`, `SSO_MAX_SKEW_SECONDS`

Do **not** set `PORT` — Hostinger's Passenger runtime assigns the port
and intercepts the server's `listen()` call.

## 5. Start and verify

Click **Restart** in the Node.js app panel, then open the application
URL. The login page should render with styling (a missing stylesheet
means `.next/static/` was not uploaded).

Then wire up the externally-reachable URLs:

- **Meta webhook** — point the Meta app's WhatsApp webhook at
  `https://your-domain/api/whatsapp/webhook`.
- **Automation cron** — if you use automation Wait steps, add a hPanel
  **Cron Job** that periodically calls
  `https://your-domain/api/automations/cron` with the
  `AUTOMATION_CRON_SECRET`. See `docs/automations-and-cron.md`.

## Redeploying

Rebuild (step 1), then re-upload the contents of `.next/standalone/`
over the Application root and **Restart** the app. Because
`/_next/static/*` filenames are content-hashed, briefly mixing old and
new chunks during the upload is safe.

## Local check before uploading

You can run the exact production server locally:

```bash
npm run start:standalone   # runs node .next/standalone/server.js
```

## Troubleshooting

- **Page loads but is unstyled / JS 404s** — `.next/static/` (and/or
  `public/`) was not uploaded into the Application root. Re-run
  `npm run build` and re-upload the whole `.next/standalone/` contents.
- **App won't start / "cannot find module"** — `node_modules/` was
  incomplete on upload, or "Run NPM Install" overwrote it. Re-upload the
  standalone `node_modules/` as-is.
- **Webhook returns 401/403** — `META_APP_SECRET` is missing or wrong;
  the webhook fails closed by design. Set it in step 4 and restart.
- **VPS instead of shared hosting?** Run the same standalone build under
  a process manager (`pm2 start .next/standalone/server.js`) behind an
  nginx reverse proxy — set `PORT` explicitly in that case.
