import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCheck,
  Contact,
  Inbox,
  KanbanSquare,
  Megaphone,
  MessageCircle,
  Plug,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { HeroVisual } from "@/components/marketing/hero-visual";

export const metadata: Metadata = {
  title: "Every conversation in one place — inbox, broadcasts & automations",
};

const features = [
  {
    icon: Inbox,
    tone: "bg-primary/12 text-primary",
    title: "Shared team inbox",
    description:
      "Every WhatsApp and SMS conversation in one place. Assign chats, reply as a team, and never lose a customer thread again.",
  },
  {
    icon: Megaphone,
    tone: "bg-[oklch(0.62_0.17_250)]/12 text-[oklch(0.55_0.17_250)] dark:text-[oklch(0.72_0.15_250)]",
    title: "Broadcast campaigns",
    description:
      "Send approved templates to thousands of contacts with per-recipient variables, live delivery tracking, and automatic retries.",
  },
  {
    icon: Workflow,
    tone: "bg-success/12 text-success",
    title: "Visual automations",
    description:
      "Trigger flows on inbound messages, tags, or schedules. Wait steps, branches, and actions — no code required.",
  },
  {
    icon: KanbanSquare,
    tone: "bg-warning/15 text-warning",
    title: "Sales pipelines",
    description:
      "Drag-and-drop deal stages tied to real conversations, so your pipeline always reflects what customers actually said.",
  },
  {
    icon: Contact,
    tone: "bg-[oklch(0.65_0.2_15)]/12 text-[oklch(0.6_0.2_15)] dark:text-[oklch(0.72_0.18_15)]",
    title: "Contacts CRM",
    description:
      "Tags, custom fields, consent records, and full message history per contact — imported from CSV or captured automatically.",
  },
  {
    icon: Bot,
    tone: "bg-accent text-accent-foreground",
    title: "AI knowledge base",
    description:
      "Feed your docs into a RAG knowledge base and let AI draft on-brand answers from your own content.",
  },
];

const steps = [
  {
    title: "Connect a provider",
    description:
      "Plug in Meta Cloud API, Twilio, or your own Jasmin SMS gateway. Credentials are encrypted with AES-256-GCM at rest.",
  },
  {
    title: "Import your contacts",
    description:
      "Bring contacts in via CSV or capture them from inbound messages and chatbot leads — tags and consent included.",
  },
  {
    title: "Automate & broadcast",
    description:
      "Launch template campaigns, route replies to the shared inbox, and let automations handle the follow-ups.",
  },
];

const integrations = [
  {
    initials: "M",
    name: "Meta Cloud API",
    description: "Official WhatsApp Business Platform — templates, media, and webhooks.",
  },
  {
    initials: "T",
    name: "Twilio",
    description: "WhatsApp via Twilio with signature-validated inbound webhooks.",
  },
  {
    initials: "J",
    name: "Jasmin SMS",
    description: "Self-hosted SMS gateway with consent, quiet hours, and A2P compliance.",
  },
  {
    initials: "S",
    name: "Supabase",
    description: "Postgres, auth, and row-level security powering org-scoped tenancy.",
  },
  {
    initials: "W",
    name: "Memberistic SSO",
    description: "Sell on WordPress; members land in the CRM already signed in.",
  },
  {
    initials: "C",
    name: "Chatbotistic",
    description: "Pull chatbot-captured leads straight into your pipelines.",
  },
];

const trustPoints = [
  "Multi-tenant & org-scoped",
  "Encrypted credentials",
  "SMS consent built in",
  "Self-hostable",
];

export default function LandingPage() {
  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mk-dot-grid absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-32 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-40 lg:pb-28">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                Dual-provider: Meta Cloud API · Twilio · SMS
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-5 font-heading text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
                Turn WhatsApp into your team&apos;s
                <span className="mk-gradient-text"> revenue machine</span>
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Chatbotistic puts every WhatsApp and SMS conversation,
                contact, and deal in one place — shared inbox, broadcast
                campaigns, sales pipelines, chatbot widgets, and visual
                automations, running on your own Meta, Twilio, or SMS gateway
                credentials.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="h-11 px-6 text-[15px]"
                  render={<Link href="/signup" />}
                >
                  Get started free
                  <ArrowRight data-icon="inline-end" className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 px-6 text-[15px]"
                  render={<Link href="/docs" />}
                >
                  <BookOpen data-icon="inline-start" className="size-4" />
                  Explore the API docs
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.32}>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-1.5">
                    <Check className="size-4 text-success" />
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <HeroVisual />
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────── Features ─────────────────────── */}
      <section id="features" className="scroll-mt-24 bg-card/60 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold tracking-wide text-primary uppercase">
              Everything in one workspace
            </span>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Built for teams that sell in chat
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From the first “hi” to the closed deal — capture, converse,
              automate, and measure without leaving the CRM.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Reveal
                key={feature.title}
                delay={(i % 3) * 0.08}
                className="h-full"
              >
                <article className="mk-card surface-interactive h-full rounded-2xl border border-border bg-card p-6">
                  <span
                    className={`mk-icon-tile flex size-11 items-center justify-center rounded-xl ${feature.tone}`}
                  >
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────── How it works ───────────────────── */}
      <section id="how-it-works" className="scroll-mt-24 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold tracking-wide text-primary uppercase">
              How it works
            </span>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Live in three steps
            </h2>
          </Reveal>

          <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
            <div
              className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
              aria-hidden="true"
            />
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.12}>
                <div className="relative text-center md:px-4">
                  <span className="relative z-10 mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-md">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── Deep dive: broadcasts ─────────────────── */}
      <section className="bg-card/60 py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.62_0.17_250)]/12 px-3 py-1 text-xs font-medium text-[oklch(0.5_0.17_250)] dark:text-[oklch(0.72_0.15_250)]">
                <Radio className="size-3.5" />
                Broadcasts
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance">
                Campaigns that reach every contact — compliantly
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Pick a template, choose your audience by tag or pipeline stage,
                and watch delivery in real time. SMS sends are consent-checked
                per recipient and blocked during quiet hours automatically.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Per-recipient template variables",
                  "Live sent / delivered / read counters",
                  "Consent gate + quiet hours on every SMS",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCheck className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="elevation-2 rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Spring sale — VIP customers</p>
                <span className="rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success">
                  Sending
                </span>
              </div>
              <div className="mt-6 space-y-5">
                {[
                  { label: "Sent", value: "1,300 / 1,300", fill: "100%", tone: "bg-primary" },
                  { label: "Delivered", value: "1,284", fill: "94%", tone: "bg-[oklch(0.62_0.17_250)]" },
                  { label: "Read", value: "1,102", fill: "82%", tone: "bg-success" },
                  { label: "Replied", value: "347", fill: "27%", tone: "bg-warning" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{row.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`mk-fill h-full rounded-full ${row.tone}`}
                        style={{ "--mk-fill": row.fill } as React.CSSProperties}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────── Deep dive: automations ─────────────────── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal delay={0.15} className="order-last lg:order-first">
            <div className="elevation-2 rounded-3xl border border-border bg-card p-6">
              <svg
                viewBox="0 0 420 240"
                className="w-full"
                role="img"
                aria-label="Automation flow: new message triggers AI reply, then a wait step, then a follow-up"
              >
                <defs>
                  <marker
                    id="mk-arrow"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--primary)" />
                  </marker>
                </defs>

                <path
                  d="M118 52 C 165 52, 165 52, 205 52"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  className="mk-dash"
                  markerEnd="url(#mk-arrow)"
                />
                <path
                  d="M270 78 C 270 105, 150 100, 118 128"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  className="mk-dash"
                  markerEnd="url(#mk-arrow)"
                />
                <path
                  d="M118 180 C 165 196, 180 196, 210 196"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  className="mk-dash"
                  markerEnd="url(#mk-arrow)"
                />

                <g>
                  <rect x="14" y="28" width="104" height="48" rx="12" fill="var(--primary)" opacity="0.14" />
                  <rect x="14" y="28" width="104" height="48" rx="12" fill="none" stroke="var(--primary)" strokeOpacity="0.4" />
                  <text x="66" y="49" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--foreground)">
                    Trigger
                  </text>
                  <text x="66" y="64" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                    New inbound message
                  </text>
                </g>

                <g>
                  <rect x="208" y="28" width="120" height="48" rx="12" fill="var(--card)" stroke="var(--border)" />
                  <text x="268" y="49" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--foreground)">
                    AI draft reply
                  </text>
                  <text x="268" y="64" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                    from knowledge base
                  </text>
                </g>

                <g>
                  <rect x="14" y="128" width="104" height="48" rx="12" fill="var(--card)" stroke="var(--border)" />
                  <text x="66" y="149" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--foreground)">
                    Wait 2 days
                  </text>
                  <text x="66" y="164" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                    unless replied
                  </text>
                </g>

                <g>
                  <rect x="214" y="172" width="150" height="48" rx="12" fill="var(--success)" opacity="0.14" />
                  <rect x="214" y="172" width="150" height="48" rx="12" fill="none" stroke="var(--success)" strokeOpacity="0.45" />
                  <text x="289" y="193" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--foreground)">
                    Send follow-up template
                  </text>
                  <text x="289" y="208" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                    + move deal to “Engaged”
                  </text>
                </g>
              </svg>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-success/12 px-3 py-1 text-xs font-medium text-success">
                <Workflow className="size-3.5" />
                Automations
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance">
                Follow-ups that run themselves
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Build flows visually: triggers on inbound messages or tags,
                wait steps measured in minutes or days, branches, and actions
                like sending templates or moving pipeline stages. A cron-backed
                engine drains pending steps even while you sleep.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Message, tag, and schedule triggers",
                  "Wait steps with reply-cancellation",
                  "Execution logs for every run",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCheck className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── Compliance band ───────────────────── */}
      <section className="bg-card/60 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="elevation-1 grid gap-8 rounded-3xl border border-border bg-card p-8 md:grid-cols-[auto_1fr] md:items-center md:p-10">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-success/12 text-success">
                <ShieldCheck className="size-7" />
              </span>
              <div>
                <h2 className="font-heading text-2xl font-bold tracking-tight">
                  Compliance is not an add-on
                </h2>
                <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
                  Express-consent records with source and timestamp, hosted
                  opt-in forms, STOP/HELP keyword handling, quiet-hours
                  enforcement, A2P 10DLC registration fields, and a full SMS
                  audit log. Provider credentials are encrypted with
                  AES-256-GCM; webhooks are HMAC- and signature-verified.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── Integrations ───────────────────── */}
      <section id="integrations" className="scroll-mt-24 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold tracking-wide text-primary uppercase">
              Integrations
            </span>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Bring your own stack
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              No lock-in: connect the messaging providers and tools you already
              run.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration, i) => (
              <Reveal key={integration.name} delay={(i % 3) * 0.08}>
                <article className="surface-interactive flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-heading text-lg font-bold text-primary">
                    {integration.initials}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                      {integration.name}
                      <Plug className="size-3.5 text-muted-foreground" />
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {integration.description}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── CTA ───────────────────────── */}
      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12">
              <div
                className="mk-blob -top-10 left-10 size-56 bg-white/25"
                aria-hidden="true"
              />
              <div
                className="mk-blob right-0 -bottom-16 size-64 bg-[oklch(0.62_0.17_250)]/50"
                aria-hidden="true"
                style={{ animationDelay: "3s" }}
              />
              <div className="relative">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/15">
                  <MessageCircle className="size-6" />
                </span>
                <h2 className="mx-auto mt-6 max-w-2xl font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Ready to run your WhatsApp like a product?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/85">
                  Create your workspace, connect a provider, and send your
                  first broadcast today.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-11 bg-white px-6 text-[15px] text-primary hover:bg-white/90"
                    render={<Link href="/signup" />}
                  >
                    <Users data-icon="inline-start" className="size-4" />
                    Create your workspace
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-11 px-6 text-[15px] text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
                    render={<Link href="/docs" />}
                  >
                    Read the docs
                    <ArrowRight data-icon="inline-end" className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
