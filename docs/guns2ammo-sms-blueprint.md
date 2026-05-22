# Guns2Ammo SMS Implementation Blueprint (Phase 1: Single Business)

## Goal
Launch a production-safe SMS system for Guns2Ammo first, validate with real operations, then reuse the same architecture for SaaS multi-tenant rollout.

## Business Scope (Guns2Ammo First)
Use SMS for:
- Booking confirmations and reminders
- Order/payment status notifications
- Customer support follow-up
- Compliance notices (appointment updates, policy reminders)

Do not use in Phase 1:
- Promotional firearm marketing blasts by default
- Any high-risk content until legal and carrier approval is explicitly documented

## Current Foundation Already Present
Existing code already provides:
- Jasmin provider support in WhatsApp config layer
- Outbound send route with compliance checks: `src/app/api/whatsapp/send/route.ts`
- Inbound SMS webhook + STOP/START/HELP handling: `src/app/api/sms/webhook/route.ts`
- Consent endpoints:
- Authenticated: `src/app/api/sms/consent/route.ts`
- Public widget: `src/app/api/sms/consent/public/route.ts`
- SMS compliance utility: `src/lib/sms/compliance.ts`
- A2P fields and consent widget schema in migrations 014/015/017

## Phase Plan

## Phase 1 - Guns2Ammo Compliance Baseline (Must Have)
1. Sender and campaign setup
- Decide one primary sender path for launch:
- Option A: 10DLC registered campaign (preferred for local brand identity)
- Option B: Toll-free SMS if throughput/review path is faster for current use case
- Record all registration IDs in `whatsapp_config` A2P fields

2. Consent capture hardening
- Enforce opt-in source tracking at every entry point:
- web form
- checkout/booking checkbox
- agent/manual consent capture
- Store evidence fields:
- contact_id
- consent status
- source
- legal text version
- timestamp
- IP/user agent where available

3. Message policy gate
- Add a pre-send policy classifier with categories:
- transactional
- support
- marketing
- Block `marketing` category by default for Guns2Ammo in Phase 1
- Allow only approved template IDs for transactional/support flows

4. Quiet hours and timezone
- Set Guns2Ammo timezone and quiet hours in config
- Validate all outbound sends against quiet-hours gate

5. Operational safety
- Rate limit per user and per contact to prevent accidental bursts
- Add idempotency keys for scheduled/batch sends to prevent duplicate sends
- Add dead-letter/error queue table for failed sends with retry reason

## Phase 2 - Guns2Ammo Production Workflow (Should Have)
1. Template governance
- Build a Guns2Ammo template catalog with status:
- draft
- approved
- blocked
- Enforce template approval before broadcast use

2. Contact segmentation
- Add dynamic segments:
- active customers
- recent bookings
- support follow-up
- opted-in transactional only
- Segment filters must always exclude opted-out contacts

3. Broadcast guardrails
- Dry-run preview (recipient count + blocked count + reason breakdown)
- Compliance preflight report before actual send
- Required human confirmation for >N recipients

4. Audit and reporting
- Daily deliverability report:
- sent
- delivered
- failed
- opt-outs
- Add compliance report export (CSV) for dispute handling

## Phase 3 - Guns2Ammo Validation Gate (Go/No-Go Before SaaS)
Success criteria for 30 days:
- 100% STOP handling within first inbound event
- 0 sends to opted-out contacts
- 0 unresolved compliance incidents
- Delivery success within agreed baseline (set business target)
- Documented operational runbook used by team without engineering intervention

If all pass, proceed to SaaS productization.

## Data Model Additions (Recommended)
Add/extend tables:
1. `sms_consent_events`
- id, contact_id, user_id, action(opt_in/opt_out/help/start/stop)
- source(webhook/widget/agent/import)
- legal_text_version
- evidence_ip
- evidence_user_agent
- created_at

2. `sms_templates`
- id, user_id, name, category(transactional/support/marketing)
- body
- status(draft/approved/blocked)
- approved_by
- approved_at

3. `sms_send_jobs`
- id, user_id, type(single/broadcast/automation)
- idempotency_key
- payload_json
- status(queued/sending/sent/failed/cancelled)
- failure_reason
- created_at, updated_at

4. `sms_send_job_items`
- id, job_id, contact_id, phone
- template_id or message_text
- status, provider_message_id, error
- sent_at, delivered_at

## API Layer Blueprint
Add endpoints:
1. `POST /api/sms/preflight`
- Input: recipient scope + template/message
- Output: allowed_count, blocked_count, blocked_reasons
- Must run before any broadcast

2. `POST /api/sms/send`
- Force `message_category`
- Enforce template/status policy
- Enforce consent + quiet hours + rate limits

3. `GET /api/sms/compliance/report`
- Range-based compliance and deliverability report

4. `POST /api/sms/templates`
- Create/update templates with approval workflow

## UI Blueprint (Guns2Ammo Admin)
Pages/components:
1. SMS Compliance Settings
- sender configuration status
- quiet hours/timezone
- legal text management

2. SMS Templates
- category badges
- approval status
- last reviewed by/date

3. SMS Campaign Composer
- recipient segment
- preflight panel
- confirmation modal with risk summary

4. Compliance Ledger
- consent timeline per contact
- export button

## Deployment Blueprint (Hostinger Node)
1. Environment variables (minimum)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `SMS_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`

2. Webhooks
- Jasmin DLR + inbound MO -> `/api/sms/webhook`
- Prefer header secret `x-sms-webhook-secret`; keep token fallback only for compatibility

3. Migration order
- Run existing migrations through 018 in sequence
- Validate `phone_normalized` backfill and unique conversation index

4. Smoke tests after deploy
- opt-in via widget
- transactional send success
- STOP inbound then send blocked
- START inbound then send allowed
- quiet hours block works
- report export returns expected data

## Real Business Rollout Checklist (Guns2Ammo)
Week 1:
- infrastructure + sender registration + consent language finalization
Week 2:
- internal testing with staff numbers + webhook verification
Week 3:
- limited customer pilot (transactional only)
Week 4:
- full production transactional rollout + daily compliance review

## SaaS Readiness Trigger
Only start SaaS build after Guns2Ammo completes 30-day validation gate and runbook stabilization.

---
Owner: Guns2Ammo / Wordpressistic
Status: Execution blueprint ready
Next step: implement Phase 1 tasks in code (starting with policy gate + preflight endpoint)
