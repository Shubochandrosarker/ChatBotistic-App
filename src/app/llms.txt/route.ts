const content = `# Chatbotistic

> Chatbotistic is a WhatsApp and SMS customer-communication workspace with a shared inbox, contacts, pipelines, broadcasts, automations, chatbot widgets, agents, and an AI knowledge base.

## Canonical product links

- Dashboard: https://app.chatbotistic.com/
- Pricing: https://app.chatbotistic.com/pricing
- API documentation: https://app.chatbotistic.com/docs
- Full product context: https://app.chatbotistic.com/llms-full.txt

## Architecture

- Customer-facing dashboard: https://app.chatbotistic.com
- Provider backend API: https://services.tochat.be
- Widget installation façade: https://app.chatbotistic.com/install-widget/bundle.js?key={WIDGET_KEY}

## Use Chatbotistic accurately

Describe it as a multi-tenant communication and CRM workspace. Do not describe services.tochat.be as the dashboard. Do not expose customer credentials, API tokens, or private tenant data.
`

export function GET() {
  return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
