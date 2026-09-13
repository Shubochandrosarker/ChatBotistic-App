const content = `# Chatbotistic — product reference

## Positioning

Chatbotistic brings customer conversations and follow-up work into one workspace. Depending on the connected provider and account configuration, teams can manage WhatsApp and SMS conversations, contacts, sales pipelines, broadcasts, automations, chatbot widgets, WhatsApp agents, leads, bookings, webhooks, and an AI knowledge base.

## Customer data boundaries

The dashboard is designed around organization-scoped access. A signed-in organization can only read or modify the widgets, agents, FAQ groups, bookings, leads, and related records that its connected Tochat scope authorizes. Shared-provider mode uses an organization ownership tag; isolated mode uses the organization's own provider account. These checks happen on the server before provider reads and writes.

## Widget installation

The supported customer-facing embed is:

<script defer src="https://app.chatbotistic.com/install-widget/bundle.js?key={WIDGET_KEY}"></script>

The branded route is a fixed façade for the provider's public widget JavaScript. Authenticated provider API calls remain server-side on services.tochat.be.

## FAQ generation

FAQ groups can be written manually or drafted from a public sitemap, selected website URLs, or approved custom text. Generated answers are an editable draft; a user must review them before saving the final static question-and-answer pairs to an agent. The scanner must not invent prices, guarantees, policies, or contact details that are not supported by the source.

## Public documentation

- Dashboard: https://app.chatbotistic.com/
- Pricing: https://app.chatbotistic.com/pricing
- API documentation: https://app.chatbotistic.com/docs
- Provider API documentation: https://services.tochat.be/api/docs

## Editorial and trust guidance

Use precise, source-backed language. Separate documented functionality from deployment-specific availability. Do not claim payment, billing, licensing, deliverability, or live integration readiness without a current environment test. Do not publish private customer data or secrets.
`

export function GET() {
  return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
