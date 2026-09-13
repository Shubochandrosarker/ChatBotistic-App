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

## Recommended: build via GitHub Actions

The repo ships a `Build deployment artifact` workflow
(`.github/workflows/deploy.yml`) that builds the app correctly and
hands you a single downloadable zip — no local Node setup, and no
thousands-of-files upload that stalls in the hPanel File Manager.

**One-time setup.** In GitHub → repo **Settings → Secrets and variables
→ Actions → New repository secret**, add:

| Secret | Value |
| ------ | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |
| `NEXT_PUBLIC_SITE_URL` | optional — defaults to `https://app.chatbotistic.com` |

**Each deploy.** GitHub → **Actions → Build deployment artifact → Run
workflow**. When it finishes, open the run and download the
**`crm-standalone`** artifact. Unzip it — it contains `server.js`,
`node_modules/`, `public/`, and `.next/` at the top level. That is the
complete app; skip to step 2.

> Why this matters: `NEXT_PUBLIC_*` values are baked into the browser
> bundle at **build time**. The workflow builds with your real Supabase
> values from the secrets above, so the bundle works. (The separate
> `CI` workflow builds with dummy values for checks only — never
> deploy that build.)

## 1. Build the app (local alternative)

If you'd rather build yourself, build **locally**, not on the shared
host — a Next build can exceed the RAM of an entry-level plan.

Public env vars (`NEXT_PUBLIC_*`) are inlined into the client bundle at
**build time**, so they must be set before you build. Put the
production values in `.env.local` (copy `.env.local.example`) or export
them:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
NEXT_PUBLIC_SITE_URL=https://app.chatbotistic.com \
npm run build
```

Then zip the output so it uploads as a single file (see step 3):

```bash
cd .next/standalone && zip -r ../../crm-standalone.zip .
```

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`,
`META_APP_SECRET`, `SSO_SHARED_SECRET`, …) are read at **runtime** — do
not bake them in; set them in hPanel (step 4).

## 2. Create the Node.js app in hPanel

First make sure the **subdomain exists**: hPanel → **Domains →
Subdomains** → create `chatbot` under `wpistic.cloud`. The Node.js panel
can't attach an app to a subdomain that doesn't exist yet — a missing
subdomain is the usual reason "Create" fails.

> The Node.js app feature is only on Hostinger's **Business** web plan
> and above (and VPS/Cloud). On the cheaper Premium plan the option is
> absent or errors — check your plan if Create keeps failing.

Then in hPanel: **Websites → your domain → Advanced → Node.js**
(labelled "Setup Node.js App" on some plans). Create an application:

| Field                   | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Node.js version         | 20 or 22 (the app requires `>=20`)                 |
| Application root         | a fresh, empty folder, e.g. `crm`                  |
| Application URL          | `app.chatbotistic.com`                             |
| Application startup file | `server.js`                                        |

If a previous failed attempt left a half-created app, delete it and
pick an empty Application root folder before retrying.

## 3. Upload the build

The Application root must end up containing `server.js`,
`node_modules/`, `public/`, and `.next/` at its top level.

**Upload it as one zip — do not drag thousands of files.** The hPanel
File Manager reliably stalls or errors partway through a multi-thousand
file `node_modules` upload. Instead:

1. Upload the single zip (`crm-standalone.zip` from the local build, or
   the artifact zip downloaded from the GitHub Actions run) into the
   Application root.
2. In the File Manager, right-click the zip → **Extract** → extract
   into the same folder.
3. Delete the zip. Confirm `server.js` now sits directly in the
   Application root (not inside a nested subfolder — if it is, move the
   contents up one level).

SFTP or SSH `rsync` also work if you prefer and your plan allows them.

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
  `https://app.chatbotistic.com/api/whatsapp/webhook`.
- **Automation cron** — if you use automation Wait steps, add a hPanel
  **Cron Job** that periodically calls
  `https://app.chatbotistic.com/api/automations/cron` with the
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

- **"Could not find a production build" / it ran `next start` without
  `next build`** — the app is being started with `npm start` (which is
  `next start`). That is **not** how this app deploys. It uses
  `output: "standalone"`: you build *off* the host and run the
  generated `server.js` directly. Fix: set the hPanel **Application
  startup file** to `server.js`, upload the prebuilt standalone bundle
  (step 3), and never run `npm start` / `npm run build` on the host.
  The startup file must be `server.js`, not an npm script.
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
