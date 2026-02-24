import Link from "next/link";
import { ArrowRight, GitBranch, Users, Sparkles } from "lucide-react";
import { PLANS, EXTRA_SEAT_PRICE } from "@memctl/shared/constants";
import { AnnouncementBanner } from "@/components/landing/announcement-banner";
import { Navbar } from "@/components/landing/navbar";
import { CodeTabs } from "@/components/landing/code-tabs";
import {
  ScrollReveal,
  ScrollParallax,
} from "@/components/landing/scroll-reveal";
import { TerminalAnimation } from "@/components/landing/terminal-animation";
import { BentoGrid } from "@/components/landing/bento-grid";
import { AnimatedChart } from "@/components/landing/animated-chart";
import { ThemeSwitcher } from "@/components/landing/theme-switcher";
import { LogoCloud } from "@/components/landing/logo-cloud";
import { BeforeAfter } from "@/components/landing/before-after";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { TrustBar } from "@/components/landing/trust-bar";
import { CopyCommand } from "@/components/copy-command";
import { NoiseTexture } from "@/components/landing/noise-texture";

const STEPS = [
  {
    icon: GitBranch,
    title: "Connect your repo",
    description:
      "Point memctl at your GitHub repository. It indexes structure, conventions, and architecture automatically.",
    code: "memctl init --repo github.com/org/project",
  },
  {
    icon: Users,
    title: "Invite your team",
    description:
      "Everyone on the team - and every AI agent they use - gets access to the same shared context.",
    code: "memctl team add --org acme-corp",
  },
  {
    icon: Sparkles,
    title: "Agents just know",
    description:
      "Claude Code, Cursor, Copilot - any agent with MCP support reads and writes to memctl automatically.",
    code: "memctl serve --mcp",
  },
];

const LANDING_PLANS = [
  {
    id: "free" as const,
    description: "For solo developers",
    features: [
      `${PLANS.free.projectLimit} project`,
      `${PLANS.free.memberLimit} seat`,
      "Basic memory & requests",
      "GitHub integration",
      "MCP protocol",
      "Community support",
    ],
    cta: "Get started free",
    highlighted: false,
  },
  {
    id: "lite" as const,
    description: "For individuals",
    features: [
      `${PLANS.lite.projectLimit} projects`,
      `${PLANS.lite.memberLimit} seats included`,
      `+$${EXTRA_SEAT_PRICE}/mo per extra seat`,
      "More memory & requests",
      "GitHub integration",
      "Email support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    id: "pro" as const,
    description: "For growing teams",
    features: [
      `${PLANS.pro.projectLimit} projects`,
      `${PLANS.pro.memberLimit} seats included`,
      `+$${EXTRA_SEAT_PRICE}/mo per extra seat`,
      "Higher limits",
      "Priority support",
      "Team collaboration",
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    id: "business" as const,
    description: "For scaling organizations",
    features: [
      `${PLANS.business.projectLimit} projects`,
      `${PLANS.business.memberLimit} seats included`,
      `+$${EXTRA_SEAT_PRICE}/mo per extra seat`,
      "High-volume limits",
      "Org-level policies",
      "SSO",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    id: "scale" as const,
    description: "For large teams",
    features: [
      `${PLANS.scale.projectLimit} projects`,
      `${PLANS.scale.memberLimit} seats included`,
      `+$${EXTRA_SEAT_PRICE}/mo per extra seat`,
      "Highest limits",
      "Org-level policies",
      "SSO",
      "Audit logs",
      "Priority support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    id: "enterprise" as const,
    description: "For large organizations",
    features: [
      "Unlimited projects",
      "Unlimited seats",
      "Unlimited memory & requests",
      "SSO & SAML",
      "Audit logs",
      "99.9% SLA",
      "Dedicated support",
      "Custom integrations",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/docs/api" },
      { label: "SDKs", href: "/docs/sdks" },
      { label: "MCP Protocol", href: "/docs/mcp" },
      { label: "Examples", href: "/docs/examples" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Press Kit", href: "/press" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
    ],
  },
];

/* --- GitHub Stats --- */

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

async function getGitHubStats() {
  try {
    const res = await fetch("https://api.github.com/repos/memctl/memctl", {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {},
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { stars: 0, forks: 0 };
    const data = await res.json();
    return {
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
    };
  } catch {
    return { stars: 0, forks: 0 };
  }
}

/* --- Page --- */

export default async function HomePage() {
  const ghStats = await getGitHubStats();

  return (
    <div className="landing-default-typography min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] selection:bg-orange-500/20">
      <AnnouncementBanner />
      <Navbar />

      {/* ================================================================
          SECTION 1 - Hero
          ================================================================ */}
      <section className="relative overflow-hidden">
        {/* ── Layer 0a: Diagonal hatching ── */}
        <div
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,var(--landing-border)_6px,var(--landing-border)_7px)] opacity-[0.25] [mask-image:radial-gradient(ellipse_60%_55%_at_40%_45%,black_50%,transparent_100%)]"
          aria-hidden="true"
        />
        {/* ── Layer 0b: Large indigo glow orb behind headline ── */}
        <div
          className="pointer-events-none absolute -left-[5%] top-[10%] h-[600px] w-[600px] rounded-full bg-indigo-500/[0.01] blur-[120px]"
          aria-hidden="true"
        />
        {/* ── Layer 0c: Thin vertical accent line from hero ── */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 z-[12] h-24 w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-[var(--landing-border)]"
          aria-hidden="true"
        />
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
          {/* Horizontal shelf line */}
          <div className="absolute left-0 right-0 top-[85%]">
            <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
              <div className="h-px bg-gradient-to-r from-[var(--landing-border)] via-transparent to-[var(--landing-border)] opacity-[0.1]" />
            </div>
          </div>
        </div>

        {/* ── Layer 1: Diagonal wash from left ── */}
        <div
          className="pointer-events-none absolute -left-[15%] top-[15%] h-[100%] w-[70%]"
          style={{
            background:
              "linear-gradient(125deg, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.15) 40%, transparent 75%)",
            filter: "blur(80px)",
            transform: "skewX(-14deg)",
          }}
          aria-hidden="true"
        />

        {/* ── Layer 2: Noise grain ── */}
        <NoiseTexture opacity={0.3} size={128} className="z-[1]" />

        {/* ── Layer 3: Edge fade ── */}
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 35% 45%, transparent 40%, var(--landing-bg) 100%)",
          }}
          aria-hidden="true"
        />

        {/* ── Layer 4: Content ── */}
        <div className="relative z-10 mx-auto max-w-[1600px] px-6 pb-20 pt-24 lg:px-8 lg:pb-28 lg:pt-36">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            {/* Left - Copy */}
            <div>
              <div className="animate-fade-in-up mb-5 font-mono text-[12px] text-[var(--landing-text-tertiary)]">
                <span className="text-[#F97316]">{"//"}</span> shared memory for
                ai coding agents
              </div>

              <h1 className="animate-fade-in-up text-[clamp(2.75rem,6.5vw,5rem)] font-extrabold leading-[1.05] [animation-delay:100ms]">
                Persistent context
                <br />
                <span className="text-[#F97316]">for every agent</span>
              </h1>

              <p className="animate-fade-in-up mt-5 max-w-[520px] text-[clamp(1rem,2vw,1.2rem)] leading-[1.65] text-[var(--landing-text-secondary)] [animation-delay:200ms]">
                Give your AI coding agents shared, branch-aware memory.
                Connected to your repos, synced across every IDE and tool via
                MCP. Every session picks up where the last one left off.
              </p>

              <div className="animate-fade-in-up mt-7 flex flex-col gap-3.5 [animation-delay:300ms] sm:flex-row">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-7 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-[#FB923C]"
                >
                  Connect your project
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex items-center rounded-lg border border-[var(--landing-border-hover)] px-7 py-3 text-sm font-medium text-[var(--landing-text-secondary)] transition-all hover:border-[#F97316] hover:text-[var(--landing-text)]"
                >
                  Read the docs
                </Link>
              </div>
            </div>

            {/* Right - Terminal */}
            <ScrollParallax effect="parallax-up" intensity={0.4}>
              <div className="animate-fade-in-up [animation-delay:500ms]">
                <TerminalAnimation />
              </div>
            </ScrollParallax>
          </div>
        </div>

        {/* ── Layer 5: Bottom fade ── */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[11] h-48"
          style={{
            background:
              "linear-gradient(to top, var(--landing-bg), transparent)",
          }}
          aria-hidden="true"
        />
      </section>

      {/* ================================================================
          SECTION 2 - Logo Cloud
          ================================================================ */}
      <LogoCloud />

      {/* ================================================================
          Before / After - The Problem
          ================================================================ */}
      <BeforeAfter />

      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      {/* ================================================================
          SECTION 3 - How It Works
          ================================================================ */}
      <section className="relative overflow-hidden py-28 lg:py-36">
        {/* ── Structural frame lines (4 lines for 3-col grid) ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
          {/* Horizontal shelf line below heading */}
          <div className="absolute left-0 right-0 top-[25%]">
            <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
              <div className="h-px bg-gradient-to-r from-[var(--landing-border)] via-transparent to-[var(--landing-border)] opacity-[0.1]" />
            </div>
          </div>
        </div>
        {/* Section-level diagonal hatching */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_7px,var(--landing-border)_7px,var(--landing-border)_8px)] opacity-[0.2] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black_40%,transparent_100%)]"
          aria-hidden="true"
        />
        {/* Blue glow orb behind cards */}
        <div
          className="pointer-events-none absolute right-[10%] top-[40%] -z-10 h-[400px] w-[400px] rounded-full bg-blue-500/[0.05] blur-[100px]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          <ScrollParallax effect="fade-scale" intensity={0.6}>
            <ScrollReveal>
              <div className="mb-16">
                <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                  FIG 01
                </span>
                <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
                  Three commands to shared context
                </h2>
                <p className="mt-4 max-w-lg text-lg text-[var(--landing-text-secondary)]">
                  From zero to team-wide AI memory in under two minutes.
                </p>
              </div>
            </ScrollReveal>
          </ScrollParallax>

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Connecting line - desktop only, animated SVG draw */}
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 md:block">
              <svg className="h-px w-full" viewBox="0 0 1200 2" fill="none">
                <line
                  x1="200"
                  y1="1"
                  x2="1000"
                  y2="1"
                  stroke="#F97316"
                  strokeWidth="1"
                  strokeDasharray="6 6"
                  opacity="0.3"
                />
              </svg>
            </div>

            {STEPS.map((step, i) => (
              <ScrollReveal
                key={i}
                animation={
                  i === 0 ? "slide-left" : i === 2 ? "slide-right" : "fade-up"
                }
                delay={i * 120}
              >
                <div className="glass-border group relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_var(--landing-glow)]">
                  {/* Diagonal hatching */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] opacity-[0.35] transition-opacity duration-300 [mask-image:linear-gradient(to_bottom,black_40%,transparent_90%)] group-hover:opacity-[0.45]"
                    aria-hidden="true"
                  />
                  {/* Step number */}
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface-2)] transition-colors group-hover:border-[#F97316]/30 group-hover:bg-[#F97316]/5">
                      <step.icon
                        className="h-5 w-5 text-[#F97316]"
                        strokeWidth={1.5}
                      />
                    </div>
                    <span className="font-mono text-xs font-medium text-[var(--landing-text-tertiary)]">
                      Step {i + 1}
                    </span>
                  </div>

                  <h3 className="mb-3 text-lg font-semibold text-[var(--landing-text)]">
                    {step.title}
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
                    {step.description}
                  </p>

                  {/* Mini code block */}
                  <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-4 py-3">
                    <code className="font-mono text-xs text-[var(--landing-text)]">
                      <span className="text-[#F97316]">$</span> {step.code}
                    </code>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* CTA */}
          <ScrollReveal delay={300}>
            <div className="mt-12 text-center">
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 text-sm font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
              >
                Read the quickstart guide
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Gradient divider with crosshair + edge dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          {/* Center crosshair */}
          <div className="relative">
            <div className="absolute -left-px -top-3 h-6 w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent" />
            <div className="absolute -left-3 -top-px h-px w-6 bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
            <div className="h-1.5 w-1.5 rounded-full border border-[var(--landing-border)] bg-[var(--landing-bg)]" />
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      {/* ================================================================
          SECTION 4 - Code Integration
          ================================================================ */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
        </div>
        {/* Section-level diagonal hatching */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,var(--landing-border)_8px,var(--landing-border)_9px)] opacity-[0.15] [mask-image:linear-gradient(to_right,black_10%,transparent_50%)]"
          aria-hidden="true"
        />
        {/* Teal glow orb, right side behind code tabs */}
        <div
          className="pointer-events-none absolute right-[5%] top-[20%] -z-10 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.04] blur-[120px]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            {/* Left - Description + Features */}
            <ScrollParallax effect="fade-scale" intensity={0.6}>
              <ScrollReveal>
                <div className="lg:sticky lg:top-28">
                  <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                    FIG 02
                  </span>
                  <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
                    Integrate in minutes
                  </h2>
                  <p className="mt-4 text-lg leading-relaxed text-[var(--landing-text-secondary)]">
                    A simple, elegant interface. Drop memctl into your stack
                    with SDKs for every language.
                  </p>

                  {/* SDK features */}
                  <div className="mt-8 space-y-4">
                    {[
                      {
                        lang: "TypeScript",
                        desc: "Full type-safe SDK with async/await",
                      },
                      {
                        lang: "Python",
                        desc: "Async support, pip installable",
                      },
                      {
                        lang: "Go",
                        desc: "Native concurrency, zero dependencies",
                      },
                      {
                        lang: "CLI",
                        desc: "One command to start the MCP server",
                      },
                    ].map((feat) => (
                      <div key={feat.lang} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 font-mono text-xs font-medium text-[#F97316]">
                          {feat.lang}
                        </span>
                        <span className="h-px flex-1 bg-[var(--landing-border)]" />
                        <span className="text-sm text-[var(--landing-text-tertiary)]">
                          {feat.desc}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex gap-4">
                    <Link
                      href="/docs"
                      className="group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                    >
                      Full documentation
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <a
                      href="https://github.com/memctl/memctl"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
                    >
                      View on GitHub
                    </a>
                  </div>
                </div>
              </ScrollReveal>
            </ScrollParallax>

            {/* Right - Code Tabs */}
            <ScrollReveal animation="slide-right" delay={100}>
              <CodeTabs />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ================================================================
          Feature Showcase - Pinned Scroll Deep Dive
          ================================================================ */}
      <FeatureShowcase />

      {/* ================================================================
          SECTION 5 - Feature Bento Grid
          ================================================================ */}
      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <section
        id="features"
        className="relative overflow-hidden py-28 lg:py-36"
      >
        {/* ── Structural frame lines (5 lines for 4-col grid) ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
          {/* Horizontal shelf line below heading */}
          <div className="absolute left-0 right-0 top-[18%]">
            <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
              <div className="h-px bg-gradient-to-r from-[var(--landing-border)] via-transparent to-[var(--landing-border)] opacity-[0.1]" />
            </div>
          </div>
        </div>
        {/* Section-level diagonal hatching */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,var(--landing-border)_8px,var(--landing-border)_9px)] opacity-[0.15] [mask-image:radial-gradient(ellipse_55%_50%_at_40%_40%,black_30%,transparent_100%)]"
          aria-hidden="true"
        />
        {/* Purple glow orb */}
        <div
          className="pointer-events-none absolute left-[15%] top-[20%] -z-10 h-[500px] w-[500px] rounded-full bg-purple-500/[0.05] blur-[120px]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          <ScrollParallax effect="fade-scale" intensity={0.6}>
            <ScrollReveal>
              <div className="mb-16">
                <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                  FIG 03
                </span>
                <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
                  Built for how teams ship code with AI
                </h2>
              </div>
            </ScrollReveal>
          </ScrollParallax>

          <BentoGrid />
        </div>
      </section>

      {/* ================================================================
          SECTION 6 - Dashboard / Metrics
          ================================================================ */}
      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <section className="relative overflow-hidden py-20 lg:py-28">
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
        </div>
        {/* Section-level diagonal hatching */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_7px,var(--landing-border)_7px,var(--landing-border)_8px)] opacity-[0.18] [mask-image:radial-gradient(ellipse_60%_60%_at_70%_50%,black,transparent)]"
          aria-hidden="true"
        />
        {/* Blue glow orb */}
        <div
          className="pointer-events-none absolute bottom-[10%] right-[15%] -z-10 h-[400px] w-[400px] rounded-full bg-blue-500/[0.05] blur-[100px]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
            {/* Left - Description */}
            <ScrollParallax effect="fade-scale" intensity={0.6}>
              <ScrollReveal>
                <div className="lg:sticky lg:top-28">
                  <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                    FIG 04
                  </span>
                  <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
                    Full visibility into your AI&apos;s context
                  </h2>
                  <p className="mt-4 text-lg leading-relaxed text-[var(--landing-text-secondary)]">
                    See exactly what your agents know. Interactive charts and
                    real-time metrics give you full control.
                  </p>

                  {/* Quick stats summary */}
                  <div className="mt-8 space-y-3">
                    {[
                      {
                        label: "Queries tracked",
                        detail: "Every MCP read/write logged",
                      },
                      {
                        label: "Memory distribution",
                        detail: "By type, file, and team",
                      },
                      {
                        label: "Live activity",
                        detail: "Real-time agent indexing feed",
                      },
                      {
                        label: "Performance",
                        detail: "Latency, uptime, throughput",
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" />
                        <span className="text-sm font-medium text-[var(--landing-text)]">
                          {item.label}
                        </span>
                        <span className="hidden text-sm text-[var(--landing-text-tertiary)] sm:inline">
                          {item.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            </ScrollParallax>

            {/* Right - Charts */}
            <ScrollReveal animation="slide-right" delay={100}>
              <AnimatedChart />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ================================================================
          Trust Bar
          ================================================================ */}
      <TrustBar />

      {/* ================================================================
          SECTION 7 - Product Messaging
          ================================================================ */}
      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <section className="relative overflow-hidden bg-[var(--landing-code-bg)] py-20 lg:py-28">
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
        </div>
        {/* Section-level diagonal hatching */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--landing-border)_6px,var(--landing-border)_7px)] opacity-[0.2] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_40%,black_40%,transparent_100%)]"
          aria-hidden="true"
        />
        {/* Indigo glow */}
        <div
          className="pointer-events-none absolute left-[30%] top-[10%] -z-10 h-[350px] w-[350px] rounded-full bg-indigo-500/[0.04] blur-[100px]"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          {/* Section header */}
          <ScrollReveal animation="fade-up">
            <div className="mb-10">
              <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[#F97316]">
                How teams use memctl
              </p>
              <p className="max-w-2xl text-lg leading-relaxed text-[var(--landing-text-secondary)]">
                Shared, persistent memory for AI coding agents. Context stays
                available across sessions, branches, and projects.
              </p>
            </div>
          </ScrollReveal>

          {/* Visual cards grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* ── Card 1: Persistent Context (wide) ── */}
            <ScrollReveal animation="fade-up" className="lg:col-span-7">
              <div className="relative h-full overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]">
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,var(--landing-border)_4px,var(--landing-border)_5px)] opacity-[0.25] [mask-image:linear-gradient(to_bottom,black_30%,transparent_80%)]"
                  aria-hidden="true"
                />
                <div className="relative grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
                  {/* Text */}
                  <div className="flex flex-col justify-center p-6 md:p-7">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded border border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <circle cx="6" cy="3" r="2" fill="#F97316" />
                          <circle
                            cx="3"
                            cy="9"
                            r="1.5"
                            fill="#F97316"
                            opacity="0.6"
                          />
                          <circle
                            cx="9"
                            cy="9"
                            r="1.5"
                            fill="#F97316"
                            opacity="0.6"
                          />
                          <line
                            x1="6"
                            y1="5"
                            x2="3"
                            y2="7.5"
                            stroke="#F97316"
                            strokeWidth="0.8"
                            opacity="0.4"
                          />
                          <line
                            x1="6"
                            y1="5"
                            x2="9"
                            y2="7.5"
                            stroke="#F97316"
                            strokeWidth="0.8"
                            opacity="0.4"
                          />
                        </svg>
                      </div>
                      <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                        01
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--landing-text)]">
                      Persistent context
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--landing-text-tertiary)]">
                      Memory is scoped by organization, project, and branch.
                      Agents resume with exactly the context they need, no
                      repeated setup.
                    </p>
                  </div>
                  {/* Visual: Scoping tree */}
                  <div className="border-t border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-5 font-mono text-[11px] leading-[1.8] md:border-l md:border-t-0">
                    <div className="text-[var(--landing-text-tertiary)]">
                      <span className="text-[#F97316]">org</span>/acme-corp
                    </div>
                    <div className="ml-2 text-[var(--landing-text-tertiary)]">
                      <span className="text-[var(--landing-text-secondary)]">
                        ├──
                      </span>{" "}
                      <span className="text-[#F97316]">project</span>/frontend
                    </div>
                    <div className="ml-6 text-[var(--landing-text-tertiary)]">
                      <span className="text-[var(--landing-text-secondary)]">
                        ├──
                      </span>{" "}
                      main
                      <span className="ml-3 text-[10px] opacity-50">
                        12 memories
                      </span>
                    </div>
                    <div className="ml-6 text-[var(--landing-text-tertiary)]">
                      <span className="text-[var(--landing-text-secondary)]">
                        ├──
                      </span>{" "}
                      feat/auth
                      <span className="ml-3 text-[10px] opacity-50">
                        3 memories
                      </span>
                    </div>
                    <div className="ml-6 text-[var(--landing-text-tertiary)]">
                      <span className="text-[var(--landing-text-secondary)]">
                        └──
                      </span>{" "}
                      fix/nav
                      <span className="ml-3 text-[10px] opacity-50">
                        1 memory
                      </span>
                    </div>
                    <div className="ml-2 text-[var(--landing-text-tertiary)]">
                      <span className="text-[var(--landing-text-secondary)]">
                        └──
                      </span>{" "}
                      <span className="text-[#F97316]">project</span>/backend
                    </div>
                    <div className="ml-6 text-[var(--landing-text-tertiary)]">
                      <span className="text-[var(--landing-text-secondary)]">
                        ├──
                      </span>{" "}
                      main
                      <span className="ml-3 text-[10px] opacity-50">
                        8 memories
                      </span>
                    </div>
                    <div className="ml-6 text-[var(--landing-text-tertiary)]">
                      <span className="text-[var(--landing-text-secondary)]">
                        └──
                      </span>{" "}
                      feat/api
                      <span className="ml-3 text-[10px] opacity-50">
                        5 memories
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ── Card 2: Shared Across Tools ── */}
            <ScrollReveal
              animation="fade-up"
              delay={100}
              className="lg:col-span-5"
            >
              <div className="relative h-full overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]">
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,var(--landing-border)_4px,var(--landing-border)_5px)] opacity-[0.25] [mask-image:linear-gradient(to_bottom,black_30%,transparent_80%)]"
                  aria-hidden="true"
                />
                <div className="relative p-6 md:p-7">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded border border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <rect
                          x="1"
                          y="4"
                          width="4"
                          height="4"
                          rx="0.5"
                          fill="#F97316"
                          opacity="0.6"
                        />
                        <rect
                          x="7"
                          y="4"
                          width="4"
                          height="4"
                          rx="0.5"
                          fill="#F97316"
                          opacity="0.6"
                        />
                        <rect
                          x="4"
                          y="1"
                          width="4"
                          height="4"
                          rx="0.5"
                          fill="#F97316"
                        />
                        <line
                          x1="6"
                          y1="5"
                          x2="3"
                          y2="4"
                          stroke="#F97316"
                          strokeWidth="0.6"
                          opacity="0.4"
                        />
                        <line
                          x1="6"
                          y1="5"
                          x2="9"
                          y2="4"
                          stroke="#F97316"
                          strokeWidth="0.6"
                          opacity="0.4"
                        />
                      </svg>
                    </div>
                    <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                      02
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--landing-text)]">
                    Shared across tools
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--landing-text-tertiary)]">
                    Access the same context through the dashboard, API, and any
                    MCP-compatible agent.
                  </p>
                </div>
                {/* Visual: Connection flow */}
                <div className="relative border-t border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-6 py-5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px] sm:gap-3">
                    {/* Left: agents */}
                    <div className="flex shrink-0 flex-col gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[var(--landing-text-tertiary)]">
                          Claude Code
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[var(--landing-text-tertiary)]">
                          Cursor
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[var(--landing-text-tertiary)]">
                          Copilot
                        </span>
                      </div>
                    </div>
                    {/* Left arrows */}
                    <div className="hidden flex-col gap-2.5 text-[var(--landing-text-tertiary)] opacity-30 sm:flex">
                      <span>---&gt;</span>
                      <span>---&gt;</span>
                      <span>---&gt;</span>
                    </div>
                    {/* Center: memctl hub */}
                    <div className="shrink-0 rounded border border-[#F97316]/30 bg-[#F97316]/[0.08] px-3 py-2.5">
                      <span className="text-[11px] font-medium text-[#F97316]">
                        memctl
                      </span>
                    </div>
                    {/* Right arrows */}
                    <div className="hidden flex-col gap-[14px] text-[var(--landing-text-tertiary)] opacity-30 sm:flex">
                      <span>&lt;---</span>
                      <span>&lt;---</span>
                    </div>
                    {/* Right: access methods */}
                    <div className="flex shrink-0 flex-col gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                        <span className="text-[var(--landing-text-tertiary)]">
                          Dashboard
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                        <span className="text-[var(--landing-text-tertiary)]">
                          REST API
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ── Card 3: Built for Operations (full width) ── */}
            <ScrollReveal
              animation="fade-up"
              delay={200}
              className="lg:col-span-12"
            >
              <div className="relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]">
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,var(--landing-border)_4px,var(--landing-border)_5px)] opacity-[0.25] [mask-image:linear-gradient(to_bottom,black_30%,transparent_80%)]"
                  aria-hidden="true"
                />
                <div className="relative grid grid-cols-1 md:grid-cols-[1fr_1.5fr]">
                  {/* Text */}
                  <div className="flex flex-col justify-center p-6 md:p-7">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded border border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <rect
                            x="1"
                            y="1"
                            width="10"
                            height="10"
                            rx="1.5"
                            stroke="#F97316"
                            strokeWidth="0.8"
                          />
                          <line
                            x1="1"
                            y1="4"
                            x2="11"
                            y2="4"
                            stroke="#F97316"
                            strokeWidth="0.6"
                            opacity="0.5"
                          />
                          <rect
                            x="2.5"
                            y="5.5"
                            width="3"
                            height="1"
                            rx="0.3"
                            fill="#F97316"
                            opacity="0.6"
                          />
                          <rect
                            x="2.5"
                            y="7.5"
                            width="5"
                            height="1"
                            rx="0.3"
                            fill="#F97316"
                            opacity="0.4"
                          />
                          <rect
                            x="2.5"
                            y="9.5"
                            width="2"
                            height="1"
                            rx="0.3"
                            fill="#F97316"
                            opacity="0.3"
                          />
                        </svg>
                      </div>
                      <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                        03
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--landing-text)]">
                      Built for operations
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--landing-text-tertiary)]">
                      Manage members, usage, billing, and access policies from
                      one place. Full visibility into your organization.
                    </p>
                  </div>
                  {/* Visual: Mini dashboard */}
                  <div className="border-t border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-5 font-mono text-[10px] md:border-l md:border-t-0">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-[var(--landing-text)]">
                        acme-corp
                      </span>
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">
                        pro plan
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[var(--landing-text-tertiary)]">
                          <span>Members</span>
                          <span>5 / 10</span>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-[var(--landing-border)]">
                          <div className="h-1 w-1/2 rounded-full bg-[#F97316]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[var(--landing-text-tertiary)]">
                          <span>Projects</span>
                          <span>3 / 20</span>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-[var(--landing-border)]">
                          <div className="h-1 w-[15%] rounded-full bg-[#F97316]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[var(--landing-text-tertiary)]">
                          <span>Memories</span>
                          <span>847 this month</span>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-[var(--landing-border)]">
                          <div className="h-1 w-[68%] rounded-full bg-[#F97316]" />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[var(--landing-text-tertiary)]">
                        <span className="flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-emerald-400" />
                          2 API keys active
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-blue-400" />
                          SSO enabled
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-amber-400" />
                          Audit log on
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 8 - Pricing
          ================================================================ */}
      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <section id="pricing" className="relative overflow-hidden py-28 lg:py-36">
        {/* ── Structural frame lines (5 lines for 4-col grid) ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
          {/* Horizontal shelf line below heading */}
          <div className="absolute left-0 right-0 top-[22%]">
            <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
              <div className="h-px bg-gradient-to-r from-[var(--landing-border)] via-transparent to-[var(--landing-border)] opacity-[0.1]" />
            </div>
          </div>
        </div>
        {/* Section-level diagonal hatching */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,var(--landing-border)_6px,var(--landing-border)_7px)] opacity-[0.2] [mask-image:linear-gradient(to_bottom,black_20%,transparent_60%)]"
          aria-hidden="true"
        />
        {/* Indigo glow behind pricing */}
        <div
          className="pointer-events-none absolute left-1/2 top-[30%] -z-10 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-400/[0.04] blur-[120px]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          <ScrollParallax effect="fade-scale" intensity={0.6}>
            <ScrollReveal>
              <div className="mb-16 text-center">
                <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                  FIG 05
                </span>
                <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
                  Simple, transparent pricing
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--landing-text-secondary)]">
                  Start free. Scale when you&apos;re ready.
                </p>
              </div>
            </ScrollReveal>
          </ScrollParallax>

          {/* Row 1: Free, Lite, Pro, Business */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {LANDING_PLANS.slice(0, 4).map((plan, i) => {
              const data = PLANS[plan.id];
              const price = data.price === -1 ? "Custom" : `$${data.price}`;
              const period =
                data.price > 0 ? "/mo" : data.price === 0 ? "/mo" : "";

              return (
                <ScrollReveal
                  key={plan.id}
                  animation="scale-up"
                  delay={i * 100}
                >
                  <div
                    className={`glass-border relative flex h-full flex-col rounded-xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_var(--landing-glow)] ${
                      plan.highlighted
                        ? "border-[#F97316]/50 bg-[var(--landing-surface)] shadow-[0_0_40px_rgba(249,115,22,0.1)]"
                        : "border-[var(--landing-border)] bg-[var(--landing-surface)]"
                    }`}
                  >
                    {/* Diagonal hatching */}
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                      aria-hidden="true"
                    >
                      <div className="h-full w-full bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] opacity-[0.35] [mask-image:linear-gradient(to_bottom,black_40%,transparent_85%)]" />
                    </div>
                    {plan.highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F97316] px-4 py-1 font-mono text-[11px] font-medium text-white">
                        Most popular
                      </div>
                    )}
                    <div className="mb-2 text-sm font-medium text-[var(--landing-text-secondary)]">
                      {data.name}
                    </div>
                    <div className="mb-1 text-sm text-[var(--landing-text-tertiary)]">
                      {plan.description}
                    </div>
                    <div className="mb-6 mt-4 flex items-baseline gap-1">
                      <span className="font-mono text-5xl font-bold text-[var(--landing-text)]">
                        {price}
                      </span>
                      {period && (
                        <span className="text-sm text-[var(--landing-text-tertiary)]">
                          {period}
                        </span>
                      )}
                    </div>
                    <ul className="mb-8 flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-3 text-sm text-[var(--landing-text-secondary)]"
                        >
                          <svg
                            className="h-4 w-4 shrink-0 text-[#F97316]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={plan.id === "enterprise" ? "/contact" : "/login"}
                      className={`block rounded-lg py-3 text-center text-sm font-medium transition-all ${
                        plan.highlighted
                          ? "bg-[#F97316] text-white hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                          : "border border-[var(--landing-border-hover)] text-[var(--landing-text-secondary)] hover:border-[#F97316] hover:text-[var(--landing-text)]"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          {/* Row 2: Scale + Enterprise, wider cards with 2-column features */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {LANDING_PLANS.slice(4).map((plan, i) => {
              const data = PLANS[plan.id];
              const price = data.price === -1 ? "Custom" : `$${data.price}`;
              const period = data.price > 0 ? "/mo" : "";

              return (
                <ScrollReveal
                  key={plan.id}
                  animation="scale-up"
                  delay={400 + i * 100}
                >
                  <div className="glass-border relative flex h-full flex-col rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_var(--landing-glow)]">
                    {/* Diagonal hatching */}
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                      aria-hidden="true"
                    >
                      <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--landing-border)_6px,var(--landing-border)_7px)] opacity-[0.25] [mask-image:linear-gradient(to_bottom_right,black_30%,transparent_70%)]" />
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="mb-2 text-sm font-medium text-[var(--landing-text-secondary)]">
                          {data.name}
                        </div>
                        <div className="mb-1 text-sm text-[var(--landing-text-tertiary)]">
                          {plan.description}
                        </div>
                        <div className="mb-6 mt-4 flex items-baseline gap-1">
                          <span className="font-mono text-5xl font-bold text-[var(--landing-text)]">
                            {price}
                          </span>
                          {period && (
                            <span className="text-sm text-[var(--landing-text-tertiary)]">
                              {period}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ul className="mb-8 grid flex-1 grid-cols-2 gap-x-6 gap-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-3 text-sm text-[var(--landing-text-secondary)]"
                        >
                          <svg
                            className="h-4 w-4 shrink-0 text-[#F97316]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={plan.id === "enterprise" ? "/contact" : "/login"}
                      className="block rounded-lg border border-[var(--landing-border-hover)] py-3 text-center text-sm font-medium text-[var(--landing-text-secondary)] transition-all hover:border-[#F97316] hover:text-[var(--landing-text)]"
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          <ScrollReveal delay={300}>
            <p className="mt-12 text-center text-sm text-[var(--landing-text-tertiary)]">
              All plans include: GitHub integration, MCP protocol support,
              encrypted at rest.{" "}
              <Link href="/pricing" className="text-[#F97316] hover:underline">
                Compare all plans
              </Link>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ================================================================
          SECTION 9 - Open Source
          ================================================================ */}
      {/* ── Gradient divider with crosshair + edge dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          {/* Center crosshair */}
          <div className="relative">
            <div className="absolute -left-px -top-3 h-6 w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent" />
            <div className="absolute -left-3 -top-px h-px w-6 bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
            <div className="h-1.5 w-1.5 rounded-full border border-[var(--landing-border)] bg-[var(--landing-bg)]" />
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <section className="relative overflow-hidden py-28 lg:py-36">
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
        </div>
        {/* Section-level diagonal hatching */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_7px,var(--landing-border)_7px,var(--landing-border)_8px)] opacity-[0.15] [mask-image:linear-gradient(to_left,black_15%,transparent_55%)]"
          aria-hidden="true"
        />
        {/* Cyan glow orb, left side */}
        <div
          className="pointer-events-none absolute left-[5%] top-[30%] -z-10 h-[450px] w-[450px] rounded-full bg-cyan-500/[0.04] blur-[120px]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          <ScrollParallax effect="fade-scale" intensity={0.6}>
            <ScrollReveal>
              <div className="mb-16">
                <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                  FIG 06
                </span>
                <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
                  Open protocol. Extensible by design.
                </h2>
              </div>
            </ScrollReveal>
          </ScrollParallax>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <ScrollReveal animation="slide-left">
              <div>
                <p className="text-lg leading-relaxed text-[var(--landing-text-secondary)]">
                  memctl&apos;s core protocol is open source. Build custom
                  integrations, contribute to the ecosystem, or self-host for
                  full control.
                </p>
                <p className="mt-4 text-lg leading-relaxed text-[var(--landing-text-secondary)]">
                  The MCP server, CLI, and SDKs are all available under the
                  Apache-2.0 license. The cloud platform adds team management,
                  hosted indexing, and enterprise features on top.
                </p>
                <div className="mt-8 flex gap-4">
                  <a
                    href="https://github.com/memctl/memctl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#FB923C]"
                  >
                    View on GitHub
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </a>
                  <Link
                    href="/docs"
                    className="inline-flex items-center rounded-lg border border-[var(--landing-border-hover)] px-5 py-2.5 text-sm font-medium text-[var(--landing-text-secondary)] transition-all hover:border-[#F97316] hover:text-[var(--landing-text)]"
                  >
                    Read the docs
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="slide-right" delay={150}>
              <div className="relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
                {/* Diagonal hatching */}
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] opacity-[0.3] [mask-image:linear-gradient(to_top_left,black_35%,transparent_80%)]"
                  aria-hidden="true"
                />
                {/* Repo card */}
                <div className="mb-6 flex items-center gap-3">
                  <svg
                    className="h-6 w-6 text-[var(--landing-text-secondary)]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <div>
                    <div className="font-mono text-sm font-semibold text-[var(--landing-text)]">
                      memctl/memctl
                    </div>
                    <div className="text-xs text-[var(--landing-text-tertiary)]">
                      Shared memory server for AI coding agents
                    </div>
                  </div>
                </div>

                <div className="mb-6 flex gap-6 font-mono text-sm">
                  <span className="flex items-center gap-1.5 text-[var(--landing-text-secondary)]">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                      />
                    </svg>
                    {formatCount(ghStats.stars)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[var(--landing-text-secondary)]">
                    <GitBranch className="h-4 w-4" />
                    {formatCount(ghStats.forks)}
                  </span>
                </div>

                {/* Mini heatmap - empty state for private repos */}
                <div className="mb-4">
                  <div className="mb-2 text-xs text-[var(--landing-text-tertiary)]">
                    Commit activity
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 24 }, (_, i) => (
                      <div
                        key={i}
                        className="h-3 flex-1 rounded-sm"
                        style={{
                          backgroundColor: "var(--landing-surface-2)",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <a
                  href="https://github.com/memctl/memctl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1 font-mono text-sm text-[#F97316] transition-colors hover:text-[#FB923C]"
                >
                  View on GitHub
                  <span className="transition-transform group-hover:translate-x-0.5">
                    &rarr;
                  </span>
                </a>
              </div>
            </ScrollReveal>
          </div>

          {/* Supported tools */}
          <ScrollReveal delay={200}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                Works with
              </span>
              {[
                "MCP Protocol",
                "Claude Code",
                "Cursor",
                "GitHub Copilot",
                "VS Code",
                "JetBrains",
                "Neovim",
                "Windsurf",
                "Cline",
              ].map((tool) => (
                <span
                  key={tool}
                  className="rounded-md border border-[var(--landing-border)] px-3 py-1.5 font-mono text-[11px] text-[var(--landing-text-tertiary)] transition-colors hover:border-[#F97316]/30 hover:text-[var(--landing-text-secondary)]"
                >
                  {tool}
                </span>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ================================================================
          SECTION 10 - CTA
          ================================================================ */}
      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
        </div>
        {/* Square grid lines, fading upward */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--landing-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--landing-border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.12] [mask-image:linear-gradient(to_top,black_20%,transparent_80%)]"
          aria-hidden="true"
        />
        {/* ── Diagonal hatching ── */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_9px,var(--landing-border)_9px,var(--landing-border)_10px)] opacity-[0.12] [mask-image:radial-gradient(ellipse_45%_50%_at_50%_60%,black_25%,transparent_70%)]"
          aria-hidden="true"
        />
        {/* Warm orange glow for CTA */}
        <div
          className="pointer-events-none absolute left-1/2 top-[40%] -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#F97316]/[0.05] blur-[120px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-[1600px] px-6 lg:px-8">
          <ScrollReveal animation="scale-up">
            <div className="text-center">
              <h2 className="text-[clamp(2rem,5vw,3rem)] font-extrabold leading-[1.1]">
                Stop re-explaining your codebase
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--landing-text-secondary)]">
                Connect your first repo and let your agents remember everything.
                One command to start.
              </p>

              <div className="mt-8 flex justify-center">
                <CopyCommand />
              </div>

              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-8 py-3.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[#FB923C]"
                >
                  Get started for free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-lg border border-[var(--landing-border-hover)] px-8 py-3.5 text-sm font-medium text-[var(--landing-text-secondary)] transition-all hover:border-[#F97316] hover:text-[var(--landing-text)]"
                >
                  Schedule a demo
                </Link>
              </div>
              <p className="mt-6 text-sm text-[var(--landing-text-tertiary)]">
                No credit card required. Free tier available forever.
              </p>
            </div>

            {/* Supported tools */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                Works with
              </span>
              {[
                "Claude Code",
                "Cursor",
                "GitHub Copilot",
                "VS Code",
                "JetBrains",
                "Neovim",
                "Windsurf",
                "Cline",
              ].map((tool) => (
                <span
                  key={tool}
                  className="rounded-md border border-[var(--landing-border)] px-3 py-1.5 font-mono text-[11px] text-[var(--landing-text-tertiary)] transition-colors hover:border-[#F97316]/30 hover:text-[var(--landing-text-secondary)]"
                >
                  {tool}
                </span>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ================================================================
          SECTION 11 - Footer
          ================================================================ */}
      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <footer className="relative overflow-hidden bg-[var(--landing-code-bg)]">
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-gradient-to-b from-transparent via-[var(--landing-border)] to-transparent opacity-[0.12]" />
          </div>
        </div>
        {/* Square grid lines, fading upward */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--landing-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--landing-border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.1] [mask-image:linear-gradient(to_top,black_10%,transparent_60%)]"
          aria-hidden="true"
        />
        {/* ── Diagonal hatching ── */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,var(--landing-border)_8px,var(--landing-border)_9px)] opacity-[0.1] [mask-image:linear-gradient(to_top,black_15%,transparent_55%)]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 py-16 lg:px-8 lg:py-20">
          <ScrollReveal animation="fade-in">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
              {/* Brand column */}
              <div className="col-span-2">
                <div className="mb-3 font-mono text-base font-semibold text-[var(--landing-text)]">
                  <span className="text-[#F97316]">{"\u25B8"}</span> memctl
                </div>
                <p className="mb-6 max-w-xs text-sm text-[var(--landing-text-tertiary)]">
                  Shared memory for AI coding agents. Cloud-based context across
                  IDEs, machines, and teams.
                </p>
                {/* Social icons */}
                <div className="flex gap-4">
                  <a
                    href="https://github.com/memctl/memctl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
                    aria-label="GitHub"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </a>
                  <a
                    href="https://x.com/memctl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
                    aria-label="X / Twitter"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href="https://discord.gg/memctl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
                    aria-label="Discord"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Link columns */}
              {FOOTER_COLS.map((col) => (
                <div key={col.title}>
                  <h4 className="mb-4 text-[12px] font-semibold uppercase text-[var(--landing-text-tertiary)]">
                    {col.title}
                  </h4>
                  <ul className="space-y-3">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bottom */}
            <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[var(--landing-border)] pt-8 text-xs text-[var(--landing-text-tertiary)] sm:flex-row">
              <div className="flex flex-col items-center gap-1 sm:items-start">
                <span>&copy; {new Date().getFullYear()} Mindroot Ltd</span>
                <span>
                  Mindroot Ltd &middot; Company No. 16543299 &middot; England
                  and Wales
                </span>
              </div>
              <ThemeSwitcher />
              <span className="font-mono text-[11px]">Apache-2.0</span>
            </div>
          </ScrollReveal>
        </div>
      </footer>
    </div>
  );
}
