import type { Metadata } from "next";
import { CodeBlock } from "@/components/marketing/code-block";
import { DocsNav, type DocsNavGroup } from "@/components/marketing/docs-nav";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "REST API reference for WPistic WhatsApp CRM — configuration, messaging, broadcasts, webhooks, SMS compliance, SSO, and self-hosting.",
};

/* ------------------------------------------------------------------ */
/* Local building blocks                                               */
/* ------------------------------------------------------------------ */

type Method = "GET" | "POST" | "PATCH" | "DELETE";

const methodTone: Record<Method, string> = {
  GET: "bg-[oklch(0.62_0.17_250)]/12 text-[oklch(0.48_0.17_250)] dark:text-[oklch(0.72_0.15_250)]",
  POST: "bg-success/12 text-success",
  PATCH: "bg-warning/15 text-warning",
  DELETE: "bg-destructive/10 text-destructive",
};

function MethodBadge({ method }: { method: Method }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold",
        methodTone[method],
      )}
    >
      {method}
    </span>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: Method;
  path: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
        <MethodBadge method={method} />
        <code className="font-mono text-sm font-medium break-all">{path}</code>
      </div>
      {children ? (
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

function ParamsTable({ title, params }: { title?: string; params: Param[] }) {
  // Informational tables (statuses, env basics) never mark anything
  // required — drop the column instead of printing "optional" rows.
  const showRequired = params.some((param) => param.required !== undefined);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">{title ?? "Parameters"}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th className="px-4 py-2.5 font-semibold">
              {title ?? "Parameter"}
            </th>
            <th className="px-4 py-2.5 font-semibold">Type</th>
            {showRequired ? (
              <th className="px-4 py-2.5 font-semibold">Required</th>
            ) : null}
            <th className="w-1/2 px-4 py-2.5 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((param) => (
            <tr
              key={param.name}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-2.5 font-mono text-[13px] text-foreground">
                {param.name}
              </td>
              <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">
                {param.type}
              </td>
              {showRequired ? (
                <td className="px-4 py-2.5">
                  {param.required ? (
                    <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                      required
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      optional
                    </span>
                  )}
                </td>
              ) : null}
              <td className="px-4 py-2.5 text-muted-foreground">
                {param.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-border py-10 first:pt-0 last:border-0">
      <h2 className="font-heading text-2xl font-bold tracking-tight">
        <a href={`#${id}`} className="group">
          {title}
          <span className="ml-2 text-primary opacity-0 transition-opacity group-hover:opacity-100">
            #
          </span>
        </a>
      </h2>
      {lead ? (
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          {lead}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation model                                                    */
/* ------------------------------------------------------------------ */

const navGroups: DocsNavGroup[] = [
  {
    heading: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "authentication", label: "Authentication" },
      { id: "errors", label: "Errors & rate limits" },
    ],
  },
  {
    heading: "Core resources",
    items: [
      { id: "configuration", label: "Provider configuration" },
      { id: "messages", label: "Messages" },
      { id: "broadcasts", label: "Broadcasts" },
      { id: "templates", label: "Templates" },
      { id: "media", label: "Media" },
      { id: "leads", label: "Leads" },
      { id: "tochat-widgets", label: "Tochat widgets" },
      { id: "automations", label: "Automations" },
      { id: "knowledge-base", label: "AI knowledge base" },
    ],
  },
  {
    heading: "Inbound & compliance",
    items: [
      { id: "webhooks", label: "Webhooks" },
      { id: "sms-compliance", label: "SMS compliance" },
    ],
  },
  {
    heading: "Platform",
    items: [
      { id: "sso", label: "SSO login" },
      { id: "environment", label: "Environment variables" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6">
      <header className="mb-4 max-w-3xl lg:mb-12">
        <span className="text-sm font-semibold tracking-wide text-primary uppercase">
          Developer documentation
        </span>
        <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">
          WPistic WhatsApp CRM API
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Everything the dashboard does runs through this JSON API — the same
          endpoints are available to your own scripts and integrations on your
          deployment.
        </p>
      </header>

      <div className="lg:flex lg:gap-10">
        <DocsNav groups={navGroups} />

        <div className="min-w-0 flex-1">
          {/* ── Overview ─────────────────────────────────────────── */}
          <Section
            id="overview"
            title="Overview"
            lead="The API is served by your CRM deployment itself. All endpoints accept and return JSON unless noted otherwise."
          >
            <ParamsTable
              title="Basics"
              params={[
                {
                  name: "Base URL",
                  type: "url",
                  description:
                    "Your deployment origin, e.g. https://chatbot.wpistic.cloud — every path below is relative to it.",
                },
                {
                  name: "Content-Type",
                  type: "header",
                  description:
                    "application/json for request bodies; responses are JSON.",
                },
                {
                  name: "Tenancy",
                  type: "concept",
                  description:
                    "Every request is scoped to the signed-in user's organization. There is no cross-org access.",
                },
              ]}
            />
            <div className="mt-4">
              <CodeBlock
                label="Quick check"
                code={`curl -s https://chatbot.wpistic.cloud/api/whatsapp/config \\
  -H 'Cookie: <your session cookie>'

# → { "configured": true, "provider": "meta", ... }`}
              />
            </div>
          </Section>

          {/* ── Authentication ──────────────────────────────────── */}
          <Section
            id="authentication"
            title="Authentication"
            lead="The API uses the same Supabase session cookie as the dashboard. Sign in through the app (or via SSO) and reuse the cookie; there are no separate API keys."
          >
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Session cookie</strong> —
                set by <code className="font-mono text-[13px]">/login</code>{" "}
                or the SSO flow. All{" "}
                <code className="font-mono text-[13px]">/api/*</code> routes
                (except webhooks and the public consent form) return{" "}
                <code className="font-mono text-[13px]">401</code> without it.
              </li>
              <li>
                <strong className="text-foreground">Webhook secrets</strong> —
                inbound webhooks authenticate with provider-specific
                verification instead: Meta uses an HMAC-SHA256 signature
                header, Twilio uses{" "}
                <code className="font-mono text-[13px]">
                  X-Twilio-Signature
                </code>
                , and the SMS gateway uses a{" "}
                <code className="font-mono text-[13px]">?token=</code> query
                secret. See{" "}
                <a href="#webhooks" className="text-primary hover:underline">
                  Webhooks
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">Cron secret</strong> — the
                automation cron endpoint requires{" "}
                <code className="font-mono text-[13px]">
                  AUTOMATION_CRON_SECRET
                </code>{" "}
                as a bearer token or query parameter.
              </li>
            </ul>
          </Section>

          {/* ── Errors ───────────────────────────────────────────── */}
          <Section
            id="errors"
            title="Errors & rate limits"
            lead="Errors share one shape: an HTTP status plus a human-readable message."
          >
            <CodeBlock
              label="Error shape"
              code={`{ "error": "Provide either \`recipients\` (preferred) or \`phone_numbers\` — must be a non-empty array" }`}
            />
            <div className="mt-4">
              <ParamsTable
                title="Status"
                params={[
                  {
                    name: "400",
                    type: "status",
                    description: "Validation failed — the message says which field.",
                  },
                  {
                    name: "401",
                    type: "status",
                    description: "Missing or expired session (or bad webhook signature).",
                  },
                  {
                    name: "403",
                    type: "status",
                    description:
                      "Authenticated but not allowed — e.g. SMS blocked by the consent gate.",
                  },
                  {
                    name: "429",
                    type: "status",
                    description:
                      "Per-user rate limit hit. Message sends and broadcast starts have independent budgets; retry after the window resets.",
                  },
                  {
                    name: "500",
                    type: "status",
                    description: "Unexpected server error — check deployment logs.",
                  },
                ]}
              />
            </div>
          </Section>

          {/* ── Configuration ───────────────────────────────────── */}
          <Section
            id="configuration"
            title="Provider configuration"
            lead="One provider config per organization. Credentials are encrypted with AES-256-GCM before they touch the database; reads return masked values."
          >
            <Endpoint method="GET" path="/api/whatsapp/config">
              <p>
                Returns the current provider, masked credentials, webhook URL,
                and SMS compliance settings.
              </p>
            </Endpoint>

            <Endpoint method="POST" path="/api/whatsapp/config">
              <p>
                Create or replace the provider configuration. Send the field
                set that matches your{" "}
                <code className="font-mono text-[13px]">provider</code>:
              </p>
              <ParamsTable
                title="Body — provider: meta"
                params={[
                  { name: "provider", type: '"meta"', required: true, description: "Meta WhatsApp Cloud API." },
                  { name: "phone_number_id", type: "string", required: true, description: "From Meta Business settings." },
                  { name: "access_token", type: "string", required: true, description: "System-user access token — stored encrypted." },
                  { name: "waba_id", type: "string", description: "WhatsApp Business Account id (enables template sync)." },
                  { name: "verify_token", type: "string", description: "Value echoed during webhook verification." },
                ]}
              />
              <ParamsTable
                title="Body — provider: twilio"
                params={[
                  { name: "provider", type: '"twilio"', required: true, description: "WhatsApp via Twilio." },
                  { name: "twilio_account_sid", type: "string", required: true, description: "Account SID (AC…)." },
                  { name: "twilio_auth_token", type: "string", required: true, description: "Auth token — stored encrypted." },
                  { name: "twilio_whatsapp_number", type: "string", description: "Sender number; or use a Messaging Service." },
                  { name: "twilio_messaging_service_sid", type: "string", description: "Messaging Service SID (MG…)." },
                ]}
              />
              <ParamsTable
                title="Body — provider: jasmin (SMS)"
                params={[
                  { name: "provider", type: '"jasmin"', required: true, description: "Self-hosted Jasmin SMS gateway." },
                  { name: "jasmin_base_url", type: "string", required: true, description: "Gateway base URL." },
                  { name: "jasmin_username", type: "string", required: true, description: "Gateway user." },
                  { name: "jasmin_password", type: "string", required: true, description: "Gateway password — stored encrypted." },
                  { name: "jasmin_default_sender", type: "string", description: "Default sender id / number." },
                ]}
              />
            </Endpoint>

            <Endpoint method="PATCH" path="/api/whatsapp/config">
              <p>Update SMS compliance settings without touching credentials.</p>
              <ParamsTable
                params={[
                  { name: "sms_quiet_hours_start", type: "number | null", description: "Hour 0–23; null disables quiet hours." },
                  { name: "sms_quiet_hours_end", type: "number | null", description: "Hour 0–23; set together with start." },
                  { name: "sms_timezone", type: "string", description: 'IANA zone, e.g. "America/New_York".' },
                  { name: "a2p_brand_id", type: "string", description: "A2P 10DLC brand registration id." },
                  { name: "a2p_campaign_id", type: "string", description: "A2P 10DLC campaign id." },
                  { name: "a2p_status", type: "string", description: "Registration status you track." },
                ]}
              />
            </Endpoint>

            <Endpoint method="DELETE" path="/api/whatsapp/config">
              <p>Remove the provider configuration for the organization.</p>
            </Endpoint>
          </Section>

          {/* ── Messages ────────────────────────────────────────── */}
          <Section
            id="messages"
            title="Messages"
            lead="Send a single message into an existing conversation. SMS sends pass through the compliance gate (consent + quiet hours) before hitting the gateway."
          >
            <Endpoint method="POST" path="/api/whatsapp/send">
              <ParamsTable
                params={[
                  { name: "conversation_id", type: "uuid", required: true, description: "Target conversation." },
                  { name: "message_type", type: '"text" | "template" | media', required: true, description: "What you are sending." },
                  { name: "content_text", type: "string", description: "Body text — required when message_type is text." },
                  { name: "template_name", type: "string", description: "Approved template — required when message_type is template." },
                  { name: "template_params", type: "string[]", description: "Positional template variables." },
                  { name: "media_url", type: "string", description: "Public URL for media messages." },
                  { name: "message_category", type: '"transactional" | "support" | "marketing"', description: "SMS policy category; marketing is held to the strictest consent rules." },
                ]}
              />
              <CodeBlock
                label="cURL"
                code={`curl -X POST https://chatbot.wpistic.cloud/api/whatsapp/send \\
  -H 'Content-Type: application/json' \\
  -H 'Cookie: <session>' \\
  -d '{
    "conversation_id": "3f6f4f1e-…",
    "message_type": "text",
    "content_text": "Your order shipped 🎉"
  }'`}
              />
            </Endpoint>
          </Section>

          {/* ── Broadcasts ──────────────────────────────────────── */}
          <Section
            id="broadcasts"
            title="Broadcasts"
            lead="Start a campaign to many recipients. On Meta/Twilio this sends an approved template; on the SMS provider it sends free-form text with {{1}}-style substitution. Every SMS recipient is consent-checked first."
          >
            <Endpoint method="POST" path="/api/whatsapp/broadcast">
              <ParamsTable
                params={[
                  { name: "recipients", type: "{ phone, params?, contact_id? }[]", required: true, description: "Preferred shape — per-recipient variables. (Legacy phone_numbers: string[] is still accepted.)" },
                  { name: "template_name", type: "string", description: "Required for meta/twilio sends." },
                  { name: "template_language", type: "string", description: 'Template locale, e.g. "en_US".' },
                  { name: "message_text", type: "string", description: "Required for SMS sends; supports {{1}}, {{2}} placeholders." },
                ]}
              />
              <CodeBlock
                label="cURL"
                code={`curl -X POST https://chatbot.wpistic.cloud/api/whatsapp/broadcast \\
  -H 'Content-Type: application/json' \\
  -H 'Cookie: <session>' \\
  -d '{
    "template_name": "spring_sale",
    "template_language": "en_US",
    "recipients": [
      { "phone": "+15551234567", "params": ["Maya", "20%"] },
      { "phone": "+15559876543", "params": ["Leo", "20%"] }
    ]
  }'`}
              />
            </Endpoint>
          </Section>

          {/* ── Templates ───────────────────────────────────────── */}
          <Section
            id="templates"
            title="Templates"
            lead="Message templates are managed in Meta Business Manager; the CRM keeps a synced local copy for pickers and broadcasts."
          >
            <Endpoint method="POST" path="/api/whatsapp/templates/sync">
              <p>
                Pulls the approved template list from Meta for the configured
                WABA and upserts it locally. Requires{" "}
                <code className="font-mono text-[13px]">waba_id</code> in the
                provider config.
              </p>
            </Endpoint>
          </Section>

          {/* ── Media ───────────────────────────────────────────── */}
          <Section
            id="media"
            title="Media"
            lead="Inbound WhatsApp media is referenced by id; this endpoint proxies the download with your credentials so the browser never sees them."
          >
            <Endpoint method="GET" path="/api/whatsapp/media/{mediaId}">
              <p>
                Streams the media file for an inbound message attachment.
                Session-scoped.
              </p>
            </Endpoint>
          </Section>

          {/* ── Leads ───────────────────────────────────────────── */}
          <Section
            id="leads"
            title="Leads"
            lead="Pull chatbot-captured leads from your connected Chatbotistic account into the CRM."
          >
            <Endpoint method="GET" path="/api/leads">
              <p>
                Returns the lead list from the configured Chatbotistic API (
                <code className="font-mono text-[13px]">
                  CHATBOTISTIC_API_URL
                </code>{" "}
                +{" "}
                <code className="font-mono text-[13px]">
                  CHATBOTISTIC_API_KEY
                </code>
                ). Use it to review and convert leads into contacts.
              </p>
            </Endpoint>
          </Section>

          {/* ── Tochat widgets ──────────────────────────────────── */}
          <Section
            id="tochat-widgets"
            title="Tochat widgets"
            lead="Org-scoped proxy to the Tochat.be widget API — the first slice of Widget Studio. Requires the master Tochat.be account (TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD) to be configured; this is a separate integration from the Leads sync above, which only reads the lead-export feed."
          >
            <Endpoint method="GET" path="/api/tochat/widgets">
              <p>List the signed-in org&apos;s widgets.</p>
            </Endpoint>
            <Endpoint method="POST" path="/api/tochat/widgets">
              <ParamsTable
                params={[
                  { name: "name", type: "string", required: true, description: "Widget name." },
                  { name: "color", type: "string", description: "Hex brand color, e.g. #27d974." },
                  { name: "widgetMessage", type: "string", description: "Greeting shown in the chat bubble." },
                  { name: "iconUrl", type: "string", description: "Launcher icon URL." },
                ]}
              />
              <p>
                Additional Tochat widget fields (banners, landing colors,
                translations, targeting) are passed through as-is — see the
                Tochat.be API reference for the full schema.
              </p>
            </Endpoint>
          </Section>

          {/* ── Automations ─────────────────────────────────────── */}
          <Section
            id="automations"
            title="Automations"
            lead="Automations are JSON flow definitions (trigger + steps). The engine executes runs; a cron pinger drains time-based wait steps."
          >
            <Endpoint method="GET" path="/api/automations">
              <p>List the organization&apos;s automations.</p>
            </Endpoint>
            <Endpoint method="POST" path="/api/automations">
              <p>Create an automation from a flow definition.</p>
            </Endpoint>
            <Endpoint method="GET" path="/api/automations/{id}">
              <p>Fetch one automation, including its flow definition.</p>
            </Endpoint>
            <Endpoint method="PATCH" path="/api/automations/{id}">
              <p>Update the definition, name, or enabled state.</p>
            </Endpoint>
            <Endpoint method="DELETE" path="/api/automations/{id}">
              <p>Delete the automation and its pending executions.</p>
            </Endpoint>
            <Endpoint method="POST" path="/api/automations/{id}/duplicate">
              <p>Clone an automation (disabled by default).</p>
            </Endpoint>
            <Endpoint method="POST" path="/api/automations/engine">
              <p>Run the execution engine for triggered flows.</p>
            </Endpoint>
            <Endpoint method="GET" path="/api/automations/cron">
              <p>
                Scheduler entry point — call it every minute from your cron
                host with the{" "}
                <code className="font-mono text-[13px]">
                  AUTOMATION_CRON_SECRET
                </code>
                . It wakes executions whose wait steps expired.
              </p>
              <CodeBlock
                label="Cron"
                code={`* * * * * curl -s "https://chatbot.wpistic.cloud/api/automations/cron?secret=$AUTOMATION_CRON_SECRET"`}
              />
            </Endpoint>
          </Section>

          {/* ── Knowledge base ──────────────────────────────────── */}
          <Section
            id="knowledge-base"
            title="AI knowledge base"
            lead="RAG store behind the AI reply drafts — entries are embedded with Cloudflare Workers AI on insert."
          >
            <Endpoint method="GET" path="/api/ai/knowledge-base">
              <p>List knowledge-base entries.</p>
            </Endpoint>
            <Endpoint method="POST" path="/api/ai/knowledge-base">
              <ParamsTable
                params={[
                  { name: "title", type: "string", required: true, description: "Entry label." },
                  { name: "content", type: "string", required: true, description: "The text that gets embedded and retrieved." },
                ]}
              />
            </Endpoint>
            <Endpoint method="DELETE" path="/api/ai/knowledge-base?id={id}">
              <p>Remove an entry and its embedding.</p>
            </Endpoint>
          </Section>

          {/* ── Webhooks ────────────────────────────────────────── */}
          <Section
            id="webhooks"
            title="Webhooks"
            lead="Point your provider at these URLs to receive inbound messages and delivery status. Each one authenticates differently — never disable the checks."
          >
            <Endpoint method="GET" path="/api/whatsapp/webhook">
              <p>
                Meta verification handshake — echoes{" "}
                <code className="font-mono text-[13px]">hub.challenge</code>{" "}
                when{" "}
                <code className="font-mono text-[13px]">hub.verify_token</code>{" "}
                matches your configured verify token.
              </p>
            </Endpoint>
            <Endpoint method="POST" path="/api/whatsapp/webhook">
              <p>
                Meta inbound events (messages, statuses). The body is verified
                against{" "}
                <code className="font-mono text-[13px]">
                  X-Hub-Signature-256
                </code>{" "}
                using{" "}
                <code className="font-mono text-[13px]">META_APP_SECRET</code>.
              </p>
            </Endpoint>
            <Endpoint method="POST" path="/api/whatsapp/twilio-webhook">
              <p>
                Twilio inbound WhatsApp messages — request authenticity is
                validated via{" "}
                <code className="font-mono text-[13px]">
                  X-Twilio-Signature
                </code>{" "}
                with{" "}
                <code className="font-mono text-[13px]">TWILIO_AUTH_TOKEN</code>
                .
              </p>
            </Endpoint>
            <Endpoint method="POST" path="/api/sms/webhook?token={secret}">
              <p>
                Jasmin SMS gateway callbacks: inbound messages (MO) and
                delivery receipts (DLR). Authenticated by the{" "}
                <code className="font-mono text-[13px]">token</code> query
                matching{" "}
                <code className="font-mono text-[13px]">
                  SMS_WEBHOOK_SECRET
                </code>
                . STOP/HELP keywords update consent automatically.
              </p>
            </Endpoint>
          </Section>

          {/* ── SMS compliance ──────────────────────────────────── */}
          <Section
            id="sms-compliance"
            title="SMS compliance"
            lead="The send gate: express consent per contact, message categories, quiet hours, and an audit log. These endpoints let you check and record consent explicitly."
          >
            <Endpoint method="POST" path="/api/sms/preflight">
              <ParamsTable
                params={[
                  { name: "contact_ids", type: "uuid[]", required: true, description: "Contacts you intend to message." },
                  { name: "message_category", type: '"transactional" | "support" | "marketing"', required: true, description: "Policy category to evaluate." },
                ]}
              />
              <p>
                Returns, per contact, whether a send would be allowed and why
                not (no consent, opted out, quiet hours).
              </p>
            </Endpoint>
            <Endpoint method="GET" path="/api/sms/consent?contact_id={id}">
              <p>Read a contact&apos;s consent record.</p>
            </Endpoint>
            <Endpoint method="POST" path="/api/sms/consent">
              <p>
                Record consent collected off-platform (paper form, verbal
                confirmation) with source and note.
              </p>
            </Endpoint>
            <Endpoint method="POST" path="/api/sms/consent/public">
              <p>
                Public endpoint behind the hosted opt-in form (
                <code className="font-mono text-[13px]">
                  /sms-optin/{"{key}"}
                </code>
                ) — submissions are stored as web-form express consent.
              </p>
            </Endpoint>
          </Section>

          {/* ── SSO ─────────────────────────────────────────────── */}
          <Section
            id="sso"
            title="SSO login"
            lead="Sell memberships on WordPress (Memberistic + Licenseistic) and let members land in the CRM already signed in. The bridge redirects the browser here with a short-lived, HMAC-signed token."
          >
            <Endpoint method="GET" path="/api/sso/login?token={sso-token}">
              <p>
                Verifies the token, provisions the user and organization from
                the claims, then redirects into{" "}
                <code className="font-mono text-[13px]">/dashboard</code> with
                a session. Failures land on{" "}
                <code className="font-mono text-[13px]">/login</code> with an
                error message.
              </p>
              <CodeBlock
                label="Token format"
                code={`base64url(JSON payload) + "." + base64url(HMAC_SHA256(encodedPayload, SSO_SHARED_SECRET))`}
              />
              <ParamsTable
                title="Claim"
                params={[
                  { name: "sub", type: "string", required: true, description: "Stable subject, e.g. wp-42 — orgs are keyed on it." },
                  { name: "email", type: "string", required: true, description: "Member email; the Supabase user is created from it." },
                  { name: "name", type: "string", description: "Display name." },
                  { name: "plan", type: "string", required: true, description: "Plan slug: free | starter | growth | agency." },
                  { name: "license_key", type: "string", description: "Licenseistic key, stored on the org." },
                  { name: "license_status", type: "string", description: "active | inactive | expired | suspended." },
                  { name: "agent_limit / widget_limit / domain_limit / contact_limit", type: "number", description: "Entitlement caps carried from the plan." },
                  { name: "white_label", type: "boolean", description: "Whether the plan includes white-labelling." },
                  { name: "allowed_domains", type: "string[]", description: "Domains the license may run on." },
                  { name: "iat / exp", type: "number", required: true, description: "Unix seconds; default max skew is 300s." },
                ]}
              />
            </Endpoint>
          </Section>

          {/* ── Environment ─────────────────────────────────────── */}
          <Section
            id="environment"
            title="Environment variables"
            lead="Self-hosting checklist — copy .env.local.example and fill these in."
          >
            <ParamsTable
              title="Variable"
              params={[
                { name: "NEXT_PUBLIC_SUPABASE_URL", type: "string", required: true, description: "Supabase project URL." },
                { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", type: "string", required: true, description: "Supabase anon key." },
                { name: "SUPABASE_SERVICE_ROLE_KEY", type: "string", required: true, description: "Service-role key for server-side provisioning." },
                { name: "ENCRYPTION_KEY", type: "hex(64)", required: true, description: "AES-256-GCM key for provider credentials." },
                { name: "META_APP_SECRET", type: "string", required: true, description: "Verifies Meta webhook signatures." },
                { name: "NEXT_PUBLIC_SITE_URL", type: "string", description: "Public origin used in generated links." },
                { name: "AUTOMATION_CRON_SECRET", type: "string", description: "Protects the automation cron endpoint." },
                { name: "TWILIO_AUTH_TOKEN", type: "string", description: "Validates Twilio webhook signatures." },
                { name: "SMS_WEBHOOK_SECRET", type: "string", description: "Token for the SMS gateway webhook." },
                { name: "SSO_SHARED_SECRET", type: "string", description: "Must equal the WordPress bridge's secret." },
                { name: "SSO_MAX_SKEW_SECONDS", type: "number", description: "Token freshness window (default 300)." },
                { name: "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN", type: "string", description: "Enable Workers-AI embeddings + drafts." },
                { name: "CHATBOTISTIC_API_URL / CHATBOTISTIC_API_KEY", type: "string", description: "Enable the leads integration." },
                { name: "TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD", type: "string", description: "Master Tochat.be account — enables Widget Studio (widgets/agents/bookings/campaigns)." },
                { name: "TOCHAT_API_BASE", type: "string", description: "Override the Tochat.be API origin (default https://services.tochat.be)." },
              ]}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
