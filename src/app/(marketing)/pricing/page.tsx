import type { Metadata } from "next";
import Link from "next/link";
import { Check, MessageCircle, Sparkles, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/marketing/reveal";
import { PaddleCheckoutButton } from "@/components/marketing/paddle-checkout";

export const metadata: Metadata = {
  title: "Pricing — from a free widget to a full WhatsApp CRM",
  description:
    "Chatbotistic plans: Free Forever, Starter, Growth and Agency. Every paid plan includes the widget builder, team inbox, broadcasts, automations and per-customer analytics isolation.",
};

// Price IDs are deployment env (PRI_*-style vars) and must be read at
// request time, not frozen into a static build.
export const dynamic = "force-dynamic";

/**
 * Price IDs are read from the SERVER env at request time (PRI_* vars)
 * so rotating a price in Paddle never needs a rebuild. Null priceId →
 * the button renders disabled with a "not configured" tooltip — the
 * plan row still communicates the tier.
 *
 * Tier matrix mirrors the Licenseistic caps seeded by the WordPress
 * memberistic-licenseistic-bridge (single source of truth:
 * chatbotistic-saas-connector/README.md).
 */
const plans = [
  {
    name: "Free Forever",
    price: "$0",
    cadence: "forever",
    tagline: "One widget, one agent — see it work.",
    features: [
      "1 chat widget",
      "1 WhatsApp agent",
      "1 domain",
      "100 messages / month",
      "Per-widget analytics",
      "WordPress plugin included",
    ],
    priceEnv: "PADDLE_PRICE_FREE",
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$19",
    cadence: "/month",
    tagline: "Small teams capturing every lead.",
    features: [
      "3 widgets · 5 agents",
      "3 domains · 2 seats",
      "1,000 messages / month",
      "Lead capture + FAQ builder",
      "Booking scheduler",
      "Email support",
    ],
    priceEnv: "PADDLE_PRICE_STARTER",
    cta: "Choose Starter",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$49",
    cadence: "/month",
    tagline: "The full CRM, automations on.",
    features: [
      "10 widgets · 20 agents",
      "10 domains · 5 seats",
      "5,000 messages / month",
      "Shared team inbox",
      "Broadcast campaigns",
      "Visual automations",
      "Sales pipelines",
    ],
    priceEnv: "PADDLE_PRICE_GROWTH",
    cta: "Choose Growth",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$149",
    cadence: "/month",
    tagline: "Run client widgets at scale.",
    features: [
      "30 widgets · unlimited agents",
      "50 domains · 15 seats",
      "25,000 messages / month",
      "White-label branding",
      "Priority support",
      "Everything in Growth",
    ],
    priceEnv: "PADDLE_PRICE_AGENCY",
    cta: "Choose Agency",
    highlight: false,
  },
];

const faqs = [
  {
    q: "Is my data isolated from other customers?",
    a: "Yes — by design, not by filters. Your dashboard runs inside your own white-label account, so widgets, agents, analytics and leads are scoped to you at the API level. On the WordPress plugin, analytics only ever query widgets registered to your license.",
  },
  {
    q: "What happens after payment?",
    a: "Paddle confirms the transaction, your license key is issued by our license server, and a welcome email with your key and setup link lands in your inbox — usually within a minute.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Subscriptions are managed by Paddle; cancel from the link in any billing email and your plan stays active until the end of the paid period.",
  },
  {
    q: "Do I need the WordPress plugin?",
    a: "No — the CRM works standalone. The plugin is how you embed widgets on WordPress sites and track their analytics without leaving wp-admin.",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <section className="pt-16 pb-10 text-center sm:pt-24">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="size-3.5 text-primary" />
            Simple pricing · cancel anytime · Paddle-secured checkout
          </div>
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            From a free widget to a full{" "}
            <span className="text-primary">WhatsApp CRM</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground sm:text-lg">
            Every plan ships the widget builder, lead capture and per-customer
            analytics isolation. Upgrade when your conversations outgrow the
            free tier.
          </p>
        </Reveal>
      </section>

      <section className="pb-8">
        <Reveal>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm ${
                  plan.highlight
                    ? "border-primary/60 shadow-md ring-1 ring-primary/20"
                    : ""
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-2">
                  {plan.name === "Free Forever" ? (
                    <Link
                      href="/register"
                      className={cn(
                        buttonVariants({ variant: plan.highlight ? "default" : "outline" }),
                        "w-full",
                      )}
                    >
                      {plan.cta}
                    </Link>
                  ) : (
                    <PaddleCheckoutButton
                      priceId={process.env[plan.priceEnv] ?? null}
                      label={plan.cta}
                      planName={plan.name}
                      variant={plan.highlight ? "default" : "outline"}
                      className="w-full"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need hundreds of widgets, an SLA, or lifetime terms?{" "}
            <a href="mailto:hello@chatbotistic.com" className="font-medium text-primary hover:underline">
              Talk to us
            </a>
            .
          </p>
        </Reveal>
      </section>

      <section className="pb-8">
        <Reveal>
          <div className="rounded-2xl border bg-secondary/40 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-foreground">
              What every plan includes
            </h2>
            <div className="mt-4 grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <strong className="text-foreground">Widget studio</strong> — build,
                  theme and embed WhatsApp widgets with agents, FAQs and booking rules.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <strong className="text-foreground">Your data only</strong> — each
                  account is isolated at the API level; nobody sees central analytics.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ArrowRight className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <strong className="text-foreground">Instant licensing</strong> — your
                  key arrives by email minutes after checkout and activates the
                  WordPress plugin.
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="pb-20">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-foreground">
            Frequently asked
          </h2>
          <div className="mx-auto mt-6 max-w-3xl divide-y rounded-2xl border bg-card shadow-sm">
            {faqs.map((f) => (
              <details key={f.q} className="group px-6 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>
    </div>
  );
}
