"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const PHASES = [
  {
    id: "index",
    step: "01",
    label: "Index",
    title: "Push code. Context updates instantly.",
    description:
      "memctl syncs your repositories and updates context after each push, re-indexing changed files and storing structured memories your agents can query.",
    code: `// Repository change received
{
  "event": "push",
  "repo": "acme/webapp",
  "branch": "feature/auth",
  "modified": [
    "src/auth/session.ts",
    "src/db/schema.ts"
  ]
}

→ Indexing 2 changed files...
→ Extracted 12 architectural patterns
→ Updated 847 memory entries
→ Context refreshed (340ms)`,
  },
  {
    id: "read",
    step: "02",
    label: "Read",
    title: "Agents pull context through MCP",
    description:
      "When an AI agent starts a session, it calls memctl through the Model Context Protocol. Architecture decisions, coding conventions, and project knowledge return in milliseconds.",
    code: `// MCP tool call → read_memory
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_memory",
    "arguments": {
      "query": "auth session handling",
      "branch": "feature/auth"
    }
  }
}

→ 3 memories returned (12ms)
→ auth/session: "JWT with 15min expiry..."
→ auth/middleware: "withAuth on /api routes..."
→ conventions: "AppError with status codes..."`,
  },
  {
    id: "write",
    step: "03",
    label: "Write",
    title: "Agents store learnings back",
    description:
      "When an agent discovers patterns or makes architectural decisions, it writes them back via MCP. Every agent on the team gets the update. Knowledge compounds over time.",
    code: `// MCP tool call → write_memory
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "write_memory",
    "arguments": {
      "key": "auth/oauth-google",
      "content": "Google OAuth via passport.js.
        Callback: /api/auth/google/callback.
        Refresh token in encrypted session.",
      "tags": ["auth", "oauth"]
    }
  }
}

→ Memory stored. Team synced.
→ sarah (Claude Code): updated
→ marcus (Cursor): updated`,
  },
];

function ProtocolLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (trimmed.startsWith("//")) {
    return <span className="text-[var(--landing-text-tertiary)]">{line}</span>;
  }
  if (trimmed.startsWith("→")) {
    return <span className="text-emerald-500">{line}</span>;
  }
  const keyMatch = line.match(/^(\s*)"([^"]+)"(\s*:\s*)(.*)/);
  if (keyMatch) {
    return (
      <>
        <span>{keyMatch[1]}</span>
        <span className="text-[#F97316]">&quot;{keyMatch[2]}&quot;</span>
        <span>{keyMatch[3]}</span>
        <span className="text-[var(--landing-text-secondary)]">
          {keyMatch[4]}
        </span>
      </>
    );
  }
  return <span className="text-[var(--landing-text-secondary)]">{line}</span>;
}

export function FeatureShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const mm = gsap.matchMedia();

      mm.add("(min-width: 1024px)", () => {
        const panels = gsap.utils.toArray<HTMLElement>(
          "[data-phase-panel]",
          section,
        );
        const dots = gsap.utils.toArray<HTMLElement>(
          "[data-phase-dot]",
          section,
        );
        const leftConn = section.querySelector(
          "[data-conn-left]",
        ) as HTMLElement | null;
        const rightConn = section.querySelector(
          "[data-conn-right]",
        ) as HTMLElement | null;

        if (panels.length < 2) return;

        // Initial states - hidden panels start shifted right, scaled up, blurred
        panels.forEach((p, i) => {
          if (i > 0)
            gsap.set(p, {
              autoAlpha: 0,
              scale: 1.04,
              xPercent: 5,
              filter: "blur(8px)",
            });
        });
        if (dots[0]) gsap.set(dots[0], { background: "#F97316", scale: 1.4 });
        if (leftConn) gsap.set(leftConn, { opacity: 1 });
        if (rightConn) gsap.set(rightConn, { opacity: 0.15 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${window.innerHeight * 3.5}`,
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
          },
        });

        // Phase 1 → Phase 2
        // Exit: slide left, shrink, blur out
        tl.to(panels[0], {
          autoAlpha: 0,
          scale: 0.96,
          xPercent: -5,
          filter: "blur(8px)",
          duration: 0.5,
        });
        // Swap connections
        if (leftConn) tl.to(leftConn, { opacity: 0.15, duration: 0.3 }, "<");
        if (rightConn) tl.to(rightConn, { opacity: 1, duration: 0.3 }, "<");
        // Enter: from right, unblur, scale to normal
        tl.fromTo(
          panels[1],
          { autoAlpha: 0, scale: 1.04, xPercent: 5, filter: "blur(8px)" },
          {
            autoAlpha: 1,
            scale: 1,
            xPercent: 0,
            filter: "blur(0px)",
            duration: 0.6,
          },
          "-=0.2",
        );
        // Dot: shrink old, grow new with micro-bounce
        if (dots[0])
          tl.to(
            dots[0],
            { background: "var(--landing-border)", scale: 1, duration: 0.2 },
            "<",
          );
        if (dots[1]) {
          tl.to(
            dots[1],
            { background: "#F97316", scale: 1.7, duration: 0.15 },
            "<",
          );
          tl.to(dots[1], { scale: 1.4, duration: 0.15 });
        }

        tl.to({}, { duration: 0.35 });

        // Phase 2 → Phase 3
        tl.to(panels[1], {
          autoAlpha: 0,
          scale: 0.96,
          xPercent: -5,
          filter: "blur(8px)",
          duration: 0.5,
        });
        tl.fromTo(
          panels[2],
          { autoAlpha: 0, scale: 1.04, xPercent: 5, filter: "blur(8px)" },
          {
            autoAlpha: 1,
            scale: 1,
            xPercent: 0,
            filter: "blur(0px)",
            duration: 0.6,
          },
          "-=0.2",
        );
        if (dots[1])
          tl.to(
            dots[1],
            { background: "var(--landing-border)", scale: 1, duration: 0.2 },
            "<",
          );
        if (dots[2]) {
          tl.to(
            dots[2],
            { background: "#F97316", scale: 1.7, duration: 0.15 },
            "<",
          );
          tl.to(dots[2], { scale: 1.4, duration: 0.15 });
        }
      });
    },
    { scope: containerRef },
  );

  return (
    <>
      {/* ── Gradient divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>

      <section ref={containerRef} className="relative overflow-hidden">
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
        {/* ── Diagonal hatching ── */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_7px,var(--landing-border)_7px,var(--landing-border)_8px)] opacity-[0.15] [mask-image:linear-gradient(to_right,black_10%,transparent_50%)]"
          aria-hidden="true"
        />
        {/* Cyan glow orb */}
        <div
          className="pointer-events-none absolute right-[5%] top-[30%] -z-10 h-[450px] w-[450px] rounded-full bg-cyan-500/[0.04] blur-[120px]"
          aria-hidden="true"
        />
        <div ref={sectionRef} className="relative lg:min-h-screen">
          <div className="mx-auto max-w-[1600px] px-6 py-20 lg:px-8 lg:py-0 lg:pt-24">
            {/* Header */}
            <div className="mb-10 lg:mb-12">
              <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                The protocol
              </span>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
                The MCP read/write loop
              </h2>
              <p className="mt-4 max-w-xl text-lg text-[var(--landing-text-secondary)]">
                Agents read context from memctl and write learnings back. Every
                session makes the whole team smarter.
              </p>
            </div>

            {/* Flow Diagram - desktop only */}
            <div className="mb-16 hidden items-center lg:flex">
              {/* GitHub node */}
              <div className="flex min-w-[180px] items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-5 py-4">
                <svg
                  className="h-6 w-6 shrink-0 text-[var(--landing-text-secondary)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <div>
                  <div className="font-mono text-xs font-bold text-[var(--landing-text)]">
                    GitHub
                  </div>
                  <div className="text-[10px] text-[var(--landing-text-tertiary)]">
                    Your repository
                  </div>
                </div>
              </div>

              {/* Left connection */}
              <div
                data-conn-left
                className="flex flex-1 flex-col items-center px-4"
              >
                <span className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                  repo sync
                </span>
                <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-[#F97316]/20">
                  <div
                    className="animate-flow-right absolute inset-0 rounded-full"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, #F97316 0, #F97316 6px, transparent 6px, transparent 14px)",
                    }}
                  />
                </div>
                <span className="mt-1 text-xs text-[#F97316]">&rarr;</span>
              </div>

              {/* memctl node (center, emphasized) */}
              <div className="relative flex min-w-[200px] items-center gap-3 overflow-hidden rounded-xl border-2 border-[#F97316]/30 bg-[var(--landing-surface)] px-6 py-5 shadow-[0_0_30px_rgba(249,115,22,0.06)]">
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,var(--landing-border)_3px,var(--landing-border)_4px)] opacity-[0.35]"
                  aria-hidden="true"
                />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/10">
                  <span className="font-mono text-sm font-bold text-[#F97316]">
                    m
                  </span>
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-[#F97316]">
                    memctl
                  </div>
                  <div className="text-[10px] text-[var(--landing-text-tertiary)]">
                    Context cloud
                  </div>
                </div>
              </div>

              {/* Right connection */}
              <div
                data-conn-right
                className="flex flex-1 flex-col items-center px-4 opacity-15"
              >
                <span className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                  MCP protocol
                </span>
                <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-[#F97316]/20">
                  <div
                    className="animate-flow-right absolute inset-0 rounded-full"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, #F97316 0, #F97316 6px, transparent 6px, transparent 14px)",
                    }}
                  />
                </div>
                <span className="mt-1 text-xs text-[#F97316]">&harr;</span>
              </div>

              {/* Agents node */}
              <div className="flex min-w-[180px] items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-5 py-4">
                <svg
                  className="h-6 w-6 shrink-0 text-[var(--landing-text-secondary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
                <div>
                  <div className="font-mono text-xs font-bold text-[var(--landing-text)]">
                    AI Agents
                  </div>
                  <div className="text-[10px] text-[var(--landing-text-tertiary)]">
                    Claude, Cursor, Copilot
                  </div>
                </div>
              </div>
            </div>

            {/* Phase dots - desktop sidebar */}
            <div className="pointer-events-none absolute left-8 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-5 lg:flex">
              {PHASES.map((phase, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    data-phase-dot
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: "var(--landing-border)" }}
                  />
                  <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--landing-text-tertiary)]">
                    {phase.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Phase panels */}
            <div className="relative">
              {PHASES.map((phase, i) => (
                <div
                  key={phase.id}
                  data-phase-panel
                  className={
                    i > 0
                      ? "mt-16 lg:absolute lg:inset-x-0 lg:top-0 lg:mt-0"
                      : ""
                  }
                >
                  <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1.2fr]">
                    {/* Left: phase info */}
                    <div>
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F97316]/10 font-mono text-xs font-bold text-[#F97316]">
                          {phase.step}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                          {phase.label}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-[var(--landing-text)] lg:text-2xl">
                        {phase.title}
                      </h3>
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--landing-text-secondary)]">
                        {phase.description}
                      </p>
                    </div>

                    {/* Right: protocol code */}
                    <div className="relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-5">
                      {/* Diagonal hatching */}
                      <div
                        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,var(--landing-border)_4px,var(--landing-border)_5px)] opacity-[0.3] [mask-image:linear-gradient(to_bottom,black_25%,transparent_65%)]"
                        aria-hidden="true"
                      />
                      <div className="mb-3 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--landing-border)]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--landing-border)]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--landing-border)]" />
                        <span className="ml-auto font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                          protocol inspector
                        </span>
                      </div>
                      <pre className="overflow-x-auto font-mono text-[12px] leading-[1.7]">
                        {phase.code.split("\n").map((line, j) => (
                          <div key={j}>
                            <ProtocolLine line={line} />
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
