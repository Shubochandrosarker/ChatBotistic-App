import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { CheckCircle2, Clock, MessageCircle } from 'lucide-react'
import { TochatApiError, widgets, type TochatWidget } from '@/lib/tochat/client'
import { publicReadScope } from '@/lib/tochat/org-config'

// ------------------------------------------------------------
// PUBLIC landing page for a published chat widget.
//
// The provider's landing editor publishes /land/{slug} links; the
// provider answers those with a redirect to
// /whatsapp-business-directory/{widget-uuid} on the white-label
// domain — this host. Before the Next.js takeover that path was
// served by the provider's frontend; this page is the branded
// replacement, rendering only public marketing fields (name,
// messages, colors, legal text) plus the same public widget loader
// customers embed on their own sites. No credentials, no org data,
// no tenant secrets ever reach this page.
// ------------------------------------------------------------

const SAFE_WIDGET_KEY = /^[A-Za-z0-9_-]{3,128}$/
const DEFAULT_COLOR = '#27d974'

export const revalidate = 300

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.chatbotistic.com').replace(/\/$/, '')
}

async function loadWidget(uuid: string): Promise<TochatWidget | null> {
  if (!SAFE_WIDGET_KEY.test(uuid)) return null
  const scope = publicReadScope()
  if (!scope) return null
  try {
    const widget = (await widgets.get(scope, uuid)) as TochatWidget
    return widget && typeof widget === 'object' ? widget : null
  } catch (err) {
    // 404 from the provider = unknown/deleted widget → notFound().
    // 401/403 is what the provider answers for unknown/abused keys too —
    // crawlers hit these paths constantly, so they are folded into the
    // same silent not-found path; only a sampled line is logged so a
    // real credential problem still leaves a trace without flooding
    // the log. Anything else logs once per occurrence.
    if (err instanceof TochatApiError && (err.status === 404 || err.status === 401 || err.status === 403)) {
      if (Date.now() - lastAccessDeniedLog > 300_000) {
        lastAccessDeniedLog = Date.now()
        console.error('[landing] widget lookup not found / denied (sampled):', err.status)
      }
    } else if (Date.now() - lastAccessDeniedLog > 300_000) {
      lastAccessDeniedLog = Date.now()
      console.error('[landing] widget lookup failed:', err instanceof Error ? err.message : err)
    }
    return null
  }
}

// Sampled-logging watermark shared by loadWidget (module scope — one
// watermark per server process is enough for noise control).
let lastAccessDeniedLog = 0

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/**
 * The provider's editors let owners paste rich text/HTML into the
 * marketing fields. This is a text-only page, so strip tags and decode
 * the common entities instead of printing them literally.
 */
function plain(value: unknown, fallback = ''): string {
  const raw = text(value)
  if (!raw) return fallback
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || fallback
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>
}): Promise<Metadata> {
  const { uuid } = await params
  const widget = await loadWidget(uuid)
  if (!widget) {
    return { title: 'Chat page not found', robots: { index: false } }
  }
  const title = `${plain(widget.legend, plain(widget.name)) || 'Chat with us'} — WhatsApp`
  const description =
    plain(widget.widgetMessage) || `Chat with ${plain(widget.name) || 'us'} live on WhatsApp.`
  const url = `${siteOrigin()}/whatsapp-business-directory/${uuid}`
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: widget.active === false ? { index: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Chatbotistic',
    },
  }
}

export default async function WidgetLandingPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const widget = await loadWidget(uuid)
  if (!widget) notFound()

  const name = plain(widget.legend, plain(widget.name)) || 'Chat with us'
  const primary = /^#[0-9a-fA-F]{3,8}$/.test(text(widget.landingPrimaryColor))
    ? text(widget.landingPrimaryColor)
    : /^#[0-9a-fA-F]{3,8}$/.test(text(widget.color))
      ? text(widget.color)
      : DEFAULT_COLOR
  const secondary = /^#[0-9a-fA-F]{3,8}$/.test(text(widget.landingSecondaryColor))
    ? text(widget.landingSecondaryColor)
    : primary
  const greeting = plain(widget.widgetMessage, 'Hi! How can we help you today?')
  const legal = plain(widget.landingLegal)
  const terms = plain(widget.landingTermsAndConditions)
  const privacy = plain(widget.landingPrivacy)
  const active = widget.active !== false

  // Distinct unpublished state: the page exists but the owner paused
  // the widget — not the same as a dead link.
  if (!active) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Clock className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-foreground">{name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This chat is currently offline. Come back a little later, or reach
            out through the business&apos;s website.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Script
        src={`/install-widget/bundle.js?key=${encodeURIComponent(uuid)}`}
        strategy="afterInteractive"
      />

      <header
        className="px-6 py-4 text-white"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl bg-white/20"
            aria-hidden
          >
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold leading-tight">{name}</p>
            <p className="text-xs text-white/85">Powered by Chatbotistic</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <h1 className="text-balance whitespace-pre-line text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {greeting}
        </h1>
        <p className="max-w-xl text-pretty text-muted-foreground sm:text-lg">
          Tap the chat button to start a WhatsApp conversation — a real person
          (or our assistant) will reply.
        </p>
        <ul className="grid gap-3 text-left text-sm text-muted-foreground sm:grid-cols-3">
          <li className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: primary }} />
            Instant WhatsApp chat — no account needed.
          </li>
          <li className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: primary }} />
            Answers to common questions before you type.
          </li>
          <li className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: primary }} />
            Your number stays private until you send.
          </li>
        </ul>
        <p className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg" style={{ backgroundColor: primary }}>
          <MessageCircle className="size-4" aria-hidden />
          Live chat — button in the corner of this page
        </p>
        <p className="text-xs text-muted-foreground">
          The chat bubble loads in the corner; tap it to start the WhatsApp
          conversation.
        </p>
      </main>

      {(legal || terms || privacy) && (
        <footer className="border-t border-border bg-card px-6 py-8">
          <div className="mx-auto max-w-4xl space-y-4 text-xs leading-relaxed text-muted-foreground">
            {legal && <p className="whitespace-pre-line">{legal}</p>}
            {terms && (
              <details>
                <summary className="cursor-pointer font-medium text-foreground">
                  Terms and conditions
                </summary>
                <p className="mt-2 whitespace-pre-line">{terms}</p>
              </details>
            )}
            {privacy && (
              <details>
                <summary className="cursor-pointer font-medium text-foreground">
                  Privacy notice
                </summary>
                <p className="mt-2 whitespace-pre-line">{privacy}</p>
              </details>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
