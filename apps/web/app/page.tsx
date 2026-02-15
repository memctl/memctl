import Link from "next/link";

const ASCII_LOGO = `
 ┌┬┐┌─┐┌┬┐ ╱ ┌─┐┌┬┐┬
 │││├┤ │││ ╱  │   │ │
 ┴ ┴└─┘┴ ┴╱   └─┘ ┴ ┴─┘`;

const PLANS = [
  { name: "Free", price: "$0", projects: "2", members: "2", memories: "1,000", api: "10,000" },
  { name: "Lite", price: "$5", projects: "5", members: "5", memories: "5,000", api: "50,000" },
  { name: "Pro", price: "$20", projects: "20", members: "15", memories: "25,000", api: "250,000" },
  { name: "Business", price: "$40", projects: "50", members: "50", memories: "100,000", api: "1,000,000" },
  { name: "Better", price: "$80", projects: "200", members: "200", memories: "500,000", api: "5,000,000" },
  { name: "Enterprise", price: "Custom", projects: "\u221E", members: "\u221E", memories: "\u221E", api: "\u221E" },
];

function SectionLabel({ children, line }: { children: React.ReactNode; line: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className="font-mono text-[11px] text-[#404040] select-none">{line}</span>
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="noise relative min-h-screen">
      <div className="scanlines" />

      {/* Nav */}
      <nav className="grid-bg border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-8">
          <span className="font-mono text-sm font-bold tracking-tight">
            mem<span className="text-primary">/</span>ctl
          </span>
          <div className="flex items-center gap-6 font-mono text-xs">
            <Link href="/docs" className="text-muted-foreground transition-colors hover:text-foreground">
              docs
            </Link>
            <Link href="/pricing" className="text-muted-foreground transition-colors hover:text-foreground">
              pricing
            </Link>
            <a href="https://github.com/memctl/memctl" className="text-muted-foreground transition-colors hover:text-foreground">
              source
            </a>
            <Link
              href="/login"
              className="border border-primary/50 px-3 py-1.5 text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* ───────────── HERO ───────────── */}
      <section className="relative border-b border-border">
        {/* Faint radial glow behind the logo */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 opacity-[0.07]"
          style={{
            width: "800px",
            height: "500px",
            background: "radial-gradient(ellipse at center, #22d3ee 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 md:px-8 md:pb-28 md:pt-32">
          {/* ASCII wordmark */}
          <pre className="glow-cyan mb-8 font-mono text-[clamp(0.55rem,1.8vw,1rem)] font-bold leading-tight text-primary animate-slide-up">
            {ASCII_LOGO}
          </pre>

          <p className="mb-10 max-w-xl font-mono text-sm leading-relaxed text-muted-foreground animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Shared, persistent memory for AI coding agents.
            <br />
            One project brain across machines and IDEs.
          </p>

          {/* Install command — looks like a real terminal line */}
          <div className="mb-10 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="inline-flex items-center border border-border bg-[#111] px-5 py-3">
              <span className="text-[#404040] select-none mr-3 font-mono text-sm">$</span>
              <span className="font-mono text-sm text-foreground">
                npx <span className="text-primary">@memctl/cli</span>
              </span>
              <span className="cursor-blink ml-1 inline-block h-4 w-[8px] bg-primary" />
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-3 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <Link
              href="/login"
              className="border border-primary bg-primary px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-transparent hover:text-primary"
            >
              Get started
            </Link>
            <Link
              href="/docs"
              className="border border-border px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
            >
              Read docs
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────── WHAT IT DOES ───────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <SectionLabel line="01">What it does</SectionLabel>

          <div className="grid gap-px border border-border bg-border md:grid-cols-3">
            {[
              {
                tag: "SHARED_MEMORY",
                desc: "Store project context, decisions, and patterns. Every agent on your team reads from the same brain. No more re-explaining your codebase.",
              },
              {
                tag: "CROSS_IDE",
                desc: "Works with Claude Code, Cursor, Windsurf, and any MCP-compatible client. Switch editors freely. Your memory travels with you.",
              },
              {
                tag: "TEAM_SYNC",
                desc: "Organization-scoped projects with role-based access. Invite team members. Everyone\u2019s agents share the same memories, instantly.",
              },
            ].map((item, i) => (
              <div key={i} className="bg-background p-8 md:p-10">
                <div className="mb-4 font-mono text-[11px] font-bold text-primary">
                  {item.tag}
                </div>
                <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── HOW IT WORKS ───────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <SectionLabel line="02">How it works</SectionLabel>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Config block — styled as a file viewer */}
            <div className="border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2">
                <span className="font-mono text-[10px] text-muted-foreground">.cursor/mcp.json</span>
              </div>
              <div className="overflow-x-auto p-0">
                <pre className="font-mono text-xs leading-relaxed">
                  <div className="line-num py-0.5 px-4" data-line="1"><span className="text-muted-foreground">{"{"}</span></div>
                  <div className="line-num py-0.5 px-4" data-line="2"><span className="text-muted-foreground">{"  "}&quot;mcpServers&quot;: {"{"}</span></div>
                  <div className="line-num py-0.5 px-4" data-line="3"><span className="text-muted-foreground">{"    "}&quot;memctl&quot;: {"{"}</span></div>
                  <div className="line-num py-0.5 px-4" data-line="4"><span className="text-muted-foreground">{"      "}&quot;command&quot;: </span><span className="text-primary">&quot;npx&quot;</span><span className="text-muted-foreground">,</span></div>
                  <div className="line-num py-0.5 px-4" data-line="5"><span className="text-muted-foreground">{"      "}&quot;args&quot;: [</span><span className="text-primary">&quot;@memctl/cli&quot;</span><span className="text-muted-foreground">],</span></div>
                  <div className="line-num py-0.5 px-4" data-line="6"><span className="text-muted-foreground">{"      "}&quot;env&quot;: {"{"}</span></div>
                  <div className="line-num py-0.5 px-4 bg-primary/[0.04]" data-line="7"><span className="text-muted-foreground">{"        "}&quot;MEMCTL_TOKEN&quot;: </span><span className="text-foreground">&quot;mctl_...&quot;</span><span className="text-muted-foreground">,</span></div>
                  <div className="line-num py-0.5 px-4 bg-primary/[0.04]" data-line="8"><span className="text-muted-foreground">{"        "}&quot;MEMCTL_ORG&quot;:   </span><span className="text-foreground">&quot;my-team&quot;</span><span className="text-muted-foreground">,</span></div>
                  <div className="line-num py-0.5 px-4 bg-primary/[0.04]" data-line="9"><span className="text-muted-foreground">{"        "}&quot;MEMCTL_PROJECT&quot;:</span><span className="text-foreground">&quot;my-app&quot;</span></div>
                  <div className="line-num py-0.5 px-4" data-line="10"><span className="text-muted-foreground">{"      }"}</span></div>
                  <div className="line-num py-0.5 px-4" data-line="11"><span className="text-muted-foreground">{"    }"}</span></div>
                  <div className="line-num py-0.5 px-4" data-line="12"><span className="text-muted-foreground">{"  }"}</span></div>
                  <div className="line-num py-0.5 px-4" data-line="13"><span className="text-muted-foreground">{"}"}</span></div>
                </pre>
              </div>
            </div>

            {/* Architecture diagram */}
            <div className="flex flex-col justify-between">
              <pre className="font-mono text-[11px] leading-relaxed text-muted-foreground md:text-xs">
{`  ┌─────────────────────────────────────┐
  │            YOUR MACHINE             │
  │                                     │
  │  ┌───────────┐    ┌──────────────┐  │
  │  │ Claude    │───▶│ @memctl/cli  │  │
  │  │ Cursor    │◀───│ (MCP server) │  │
  │  │ Windsurf  │    └──────┬───────┘  │
  │  └───────────┘           │          │
  └──────────────────────────┼──────────┘
                             │
                      HTTPS  │  Bearer token
                             │
                  ┌──────────┴──────────┐
                  │    memctl.com/api    │
                  │    ┌────────────┐   │
                  │    │   Turso    │   │
                  │    │  (libSQL)  │   │
                  │    └────────────┘   │
                  └─────────────────────┘`}
              </pre>
              <div className="mt-6 border-l-2 border-primary/30 pl-4">
                <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                  Your agent stores and retrieves memories via MCP tools.
                  The server syncs to the cloud. Every team member&apos;s agent
                  sees the same project context — instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── PRICING ───────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <SectionLabel line="03">Pricing</SectionLabel>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-right font-medium">/mo</th>
                  <th className="px-4 py-3 text-right font-medium">Projects</th>
                  <th className="px-4 py-3 text-right font-medium">Members</th>
                  <th className="px-4 py-3 text-right font-medium">Memories</th>
                  <th className="px-4 py-3 text-right font-medium">API calls</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map((plan, i) => (
                  <tr key={i} className="pricing-row border-b border-border">
                    <td className="px-4 py-3.5 text-left font-bold text-foreground">
                      {plan.name}
                      {plan.name === "Free" && (
                        <span className="ml-2 text-[10px] font-normal text-primary">current</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{plan.price}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{plan.projects}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{plan.members}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{plan.memories}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{plan.api}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 font-mono text-[11px] text-[#404040]">
            All plans include unlimited read operations. Upgrade or downgrade anytime.
          </p>
        </div>
      </section>

      {/* ───────────── OPEN SOURCE ───────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <SectionLabel line="04">Open source</SectionLabel>

          <div className="grid gap-8 md:grid-cols-[1fr,auto]">
            <div>
              <p className="mb-2 font-mono text-sm text-foreground">
                Apache-2.0 licensed. Run it yourself or use our cloud.
              </p>
              <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                The entire codebase is open — MCP server, dashboard, API, database schema.
                Deploy on your own infrastructure with full control. No vendor lock-in,
                no proprietary protocols.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="https://github.com/memctl/memctl"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-border px-5 py-2.5 text-center font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-all hover:border-primary hover:text-primary"
              >
                View source
              </a>
              <div className="font-mono text-[10px] text-[#404040] text-center">
                Apache-2.0
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── FOOTER ───────────── */}
      <footer className="grid-bg">
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 font-mono text-[11px] text-[#505050]">
              <a href="https://github.com/memctl/memctl" className="transition-colors hover:text-muted-foreground">
                github
              </a>
              <Link href="/docs" className="transition-colors hover:text-muted-foreground">
                docs
              </Link>
              <Link href="/pricing" className="transition-colors hover:text-muted-foreground">
                pricing
              </Link>
            </div>
            <span className="font-mono text-[11px] text-[#303030]">
              mem/ctl
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
