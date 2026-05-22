# crm.wpistic.com Live Deploy Runbook (Guns2Ammo SMS Phase 1)

This runbook is for direct live deployment to `https://crm.wpistic.com` with Jasmin SMS and Guns2Ammo-safe policy defaults.

## 1. Pre-deploy local checks

Run from project root:

```bash
npm run typecheck
npm run test
npm run build
```

All three must pass.

## 2. Database migrations (Supabase SQL Editor)

Run migration files in order through latest:

1. `001_initial_schema.sql`
2. `002...018` (all existing files in sequence)
3. `019_sms_policy_preflight_and_consent_events.sql`

Critical for SMS Phase 1:
- `014_sms_compliance.sql`
- `015_sms_a2p_registration.sql`
- `017_sms_consent_widget.sql`
- `018_contact_phone_norm_and_conversation_uniques.sql`
- `019_sms_policy_preflight_and_consent_events.sql`

## 3. Hostinger environment variables

Use the template file:
- `.env.production.crm.wpistic.com.example`

Set these in Hostinger Node App panel:
- `NEXT_PUBLIC_SITE_URL=https://crm.wpistic.com`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `META_APP_SECRET`
- `SMS_WEBHOOK_SECRET`
- `ALLOW_FFL_MARKETING_SMS=false`

## 4. Build artifact and upload

Use your existing standalone flow from `DEPLOY.md`:
- Build standalone
- Upload `.next/standalone` contents to Node app root
- Startup file: `server.js`
- Restart app

## 5. Jasmin webhook configuration

Set webhook URL:

- `https://crm.wpistic.com/api/sms/webhook`

Preferred auth:
- HTTP header: `x-sms-webhook-secret: <SMS_WEBHOOK_SECRET>`

Fallback compatibility:
- query param `?token=<SMS_WEBHOOK_SECRET>`

## 6. Guns2Ammo Phase 1 operating rules

- Only send `message_category`:
  - `transactional`
  - `support`
- `marketing` remains blocked while `ALLOW_FFL_MARKETING_SMS=false`
- Always run preflight before bulk send

## 7. API smoke tests

Use an authenticated session/token context from your app.

### 7.1 Consent capture (authenticated)

```bash
curl -X POST "https://crm.wpistic.com/api/sms/consent" \
  -H "Content-Type: application/json" \
  -H "Cookie: <YOUR_AUTH_COOKIE>" \
  -d '{
    "contact_id":"CONTACT_UUID",
    "status":"opted_in",
    "source":"web_form",
    "age_confirmed":true,
    "legal_text_version":"g2a_sms_v1_2026-05-22"
  }'
```

Expected: `{"success":true,...}`

### 7.2 Preflight (required before bulk send)

```bash
curl -X POST "https://crm.wpistic.com/api/sms/preflight" \
  -H "Content-Type: application/json" \
  -H "Cookie: <YOUR_AUTH_COOKIE>" \
  -d '{
    "contact_ids":["CONTACT_UUID_1","CONTACT_UUID_2"],
    "message_category":"transactional"
  }'
```

Expected:
- `summary.allowed` and `summary.blocked`
- `reason_breakdown` present

### 7.3 Send SMS (Jasmin)

```bash
curl -X POST "https://crm.wpistic.com/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "Cookie: <YOUR_AUTH_COOKIE>" \
  -d '{
    "conversation_id":"CONVERSATION_UUID",
    "message_type":"text",
    "message_category":"transactional",
    "content_text":"Your Guns2Ammo booking is confirmed for tomorrow at 3:00 PM."
  }'
```

Expected: success response with `message_id` and provider message ID.

### 7.4 STOP/START/HELP behavior

From a real phone, send to your Jasmin number:
- `STOP` => future sends blocked, confirmation reply sent
- `START` => send re-enabled, confirmation reply sent
- `HELP` => help reply sent

## 8. Pass/fail checklist (must pass before production use)

1. App loads at `https://crm.wpistic.com/login`
2. Jasmin config saves and verifies in Settings
3. Consent opt-in is recorded with legal text version
4. Preflight returns accurate blocked reasons
5. Transactional send succeeds for opted-in contact
6. Send is blocked after STOP
7. Send re-enabled after START
8. Build remains passing after deploy (`npm run build` locally)

## 9. Rollback plan

If production issue:
1. Set `ALLOW_FFL_MARKETING_SMS=false` (already default)
2. Pause outbound SMS operations
3. Redeploy last known working standalone bundle
4. Re-run smoke tests 7.1 to 7.4 before resuming

