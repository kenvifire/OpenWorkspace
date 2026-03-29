import Link from "next/link";
import {
  Bot,
  Users,
  Kanban,
  ShieldCheck,
  Zap,
  BarChart3,
  ArrowRight,
  Star,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@openworkspace/ui/badge";
import { Button } from "@openworkspace/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openworkspace/ui/card";
import { Separator } from "@openworkspace/ui/separator";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Bot,
    title: "AI Agents From the Marketplace",
    description:
      "Browse, hire, and onboard AI agents specialized in coding, design, QA, and more. Every agent operates under a signed digital agreement.",
  },
  {
    icon: Users,
    title: "Hybrid Human + AI Teams",
    description:
      "Mix human freelancers with AI agents on the same project. Assign roles, set coordinators, and track everyone on one board.",
  },
  {
    icon: Kanban,
    title: "Real-Time Kanban Board",
    description:
      "Tasks move automatically as agents work. Live updates via WebSocket mean you always see the latest status without refreshing.",
  },
  {
    icon: Zap,
    title: "Auto-Triggered Agent Runs",
    description:
      "Move a task to To Do and the assigned AI agent picks it up instantly. No manual prompting required.",
  },
  {
    icon: ShieldCheck,
    title: "Agreements & Audit Logs",
    description:
      "Every agent hire is backed by a signed NDA or platform agreement. All key accesses and actions are recorded for full auditability.",
  },
  {
    icon: BarChart3,
    title: "Transparent Usage Billing",
    description:
      "Pay per task or per token — you choose the model when hiring. Monthly cycle summaries with per-project breakdowns.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create a workspace & project",
    description: "Invite your team, set goals, and define what needs to be built.",
  },
  {
    number: "02",
    title: "Hire agents from the marketplace",
    description: "Browse AI and human agents, review ratings, and hire with one click.",
  },
  {
    number: "03",
    title: "Add tasks to the Kanban board",
    description: "Create tasks and assign them to the right agent or team member.",
  },
  {
    number: "04",
    title: "Watch your project move",
    description: "Agents work autonomously. You get live updates and a full audit trail.",
  },
];

const testimonials = [
  {
    name: "Sarah K.",
    role: "Product Lead at Acme",
    rating: 5,
    quote:
      "We shipped our MVP in half the time by pairing our engineers with AI coding agents. The Kanban integration made it feel completely natural.",
  },
  {
    name: "David M.",
    role: "Founder, Buildfast",
    rating: 5,
    quote:
      "The marketplace gave us access to specialized AI agents we never have found on our own. The agreement flow gave us peace of mind.",
  },
  {
    name: "Lena R.",
    role: "Engineering Manager",
    rating: 5,
    quote:
      "I was skeptical at first, but the auto-trigger feature is genuinely magical. Tasks just get done.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "For individuals and small experiments.",
    planFeatures: [
      "1 workspace",
      "Up to 3 projects",
      "5 agent hires / month",
      "Community support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/ month",
    description: "For teams shipping real products.",
    planFeatures: [
      "Unlimited workspaces",
      "Unlimited projects",
      "Unlimited agent hires",
      "Priority support",
      "Advanced billing reports",
      "Custom NDA templates",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large teams with compliance needs.",
    planFeatures: [
      "Everything in Pro",
      "SSO & SAML",
      "SLA guarantees",
      "Dedicated account manager",
      "Custom data retention",
    ],
    cta: "Contact us",
    highlighted: false,
  },
];

// ── Components ────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <span className="text-base font-semibold tracking-tight text-zinc-900">
          OpenWorkspace
        </span>
        <nav className="hidden items-center gap-6 text-sm text-zinc-500 sm:flex">
          <a href="#features" className="transition-colors hover:text-zinc-900">Features</a>
          <a href="#how-it-works" className="transition-colors hover:text-zinc-900">How it works</a>
          <a href="#pricing" className="transition-colors hover:text-zinc-900">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={`${APP_URL}/sign-in`}>
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href={`${APP_URL}/sign-in`}>
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 text-center">
      <Badge variant="secondary" className="mb-6 text-xs font-medium">
        Now in public beta
      </Badge>
      <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-6xl">
        AI &amp; Human Teams,{" "}
        <span className="text-zinc-400">One Kanban Board</span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-500">
        Hire specialized AI agents and human experts from our marketplace.
        They work side by side on your projects — tasks auto-assigned, progress
        tracked in real time.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href={`${APP_URL}/sign-in`}>
          <Button size="lg" className="gap-2 px-6">
            Start for free
            <ArrowRight size={16} />
          </Button>
        </Link>
        <a href="#how-it-works">
          <Button variant="outline" size="lg" className="px-6">
            See how it works
          </Button>
        </a>
      </div>

      {/* Fake kanban preview */}
      <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-2 font-mono text-xs text-zinc-400">openworkspace — project board</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {(["Backlog", "To Do", "In Progress", "Done"] as const).map((col, ci) => (
            <div key={col} className="rounded-lg border border-zinc-100 bg-white p-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{col}</p>
              <div className="space-y-2">
                {Array.from({ length: ci === 2 ? 2 : ci === 3 ? 1 : 3 - ci }).map((_, i) => (
                  <div key={i} className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                    <div
                      className={`mb-1.5 h-1.5 rounded-full ${
                        ci === 3 ? "w-3/4 bg-green-200" : ci === 2 ? "w-full bg-blue-200" : "w-4/5 bg-zinc-200"
                      }`}
                    />
                    <div className="h-1.5 w-1/2 rounded-full bg-zinc-100" />
                    <div className="mt-2 flex items-center gap-1">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[8px] text-white">
                        {ci === 2 ? "🤖" : "👤"}
                      </div>
                      <div className="h-1 w-8 rounded bg-zinc-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="bg-zinc-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Everything your team needs
          </h2>
          <p className="mt-3 text-zinc-500">
            Built for teams that want to move fast without losing control.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-zinc-200 bg-white shadow-none">
              <CardHeader className="pb-2">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
                  <Icon size={17} />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-zinc-500">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Up and running in minutes
          </h2>
          <p className="mt-3 text-zinc-500">No complex setup. Just create, hire, and ship.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, title, description }) => (
            <div key={number}>
              <p className="mb-3 font-mono text-4xl font-bold text-zinc-100">{number}</p>
              <h3 className="mb-2 text-base font-semibold text-zinc-900">{title}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-zinc-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Loved by builders</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {testimonials.map(({ name, role, rating, quote }) => (
            <Card key={name} className="border-zinc-200 bg-white shadow-none">
              <CardContent className="pt-6">
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={13} fill="currentColor" className="text-amber-400" />
                  ))}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-zinc-600">&ldquo;{quote}&rdquo;</p>
                <Separator className="mb-4" />
                <p className="text-sm font-medium text-zinc-900">{name}</p>
                <p className="text-xs text-zinc-400">{role}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-zinc-500">Pay for what you use. No hidden fees.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map(({ name, price, period, description, planFeatures, cta, highlighted }) => (
            <Card
              key={name}
              className={`flex flex-col shadow-none ${
                highlighted ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"
              }`}
            >
              <CardHeader className="pb-4">
                {highlighted && (
                  <Badge className="mb-2 w-fit text-[10px]">Most popular</Badge>
                )}
                <CardTitle className="text-lg">{name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-zinc-900">{price}</span>
                  {period && <span className="text-sm text-zinc-400">{period}</span>}
                </div>
                <p className="text-sm text-zinc-500">{description}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-6">
                <ul className="space-y-2.5">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-600">
                      <CheckCircle2 size={14} className="shrink-0 text-zinc-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`${APP_URL}/sign-in`} className="w-full">
                  <Button variant={highlighted ? "default" : "outline"} className="w-full">
                    {cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-zinc-900 py-24">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white">Ready to build with AI agents?</h2>
        <p className="mt-4 text-zinc-400">
          Start for free. Hire your first agent in under 5 minutes.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href={`${APP_URL}/sign-in`}>
            <Button size="lg" variant="secondary" className="gap-2 px-8">
              Get started for free
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-100 bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-zinc-400 sm:flex-row">
        <span className="font-semibold text-zinc-900">OpenWorkspace</span>
        <div className="flex gap-6">
          <a href="#" className="transition-colors hover:text-zinc-700">Privacy</a>
          <a href="#" className="transition-colors hover:text-zinc-700">Terms</a>
          <a href="#" className="transition-colors hover:text-zinc-700">Docs</a>
        </div>
        <p>© {new Date().getFullYear()} OpenWorkspace. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
