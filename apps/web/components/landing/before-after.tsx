"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const PAIN_POINTS = [
  "AI scans entire codebase every session",
  "Context lost when switching IDEs or machines",
  "Team members get conflicting suggestions",
  "No memory of past decisions or conventions",
  "Repeated explanations of architecture",
];

const SOLUTIONS = [
  "Instant context from the first keystroke",
  "Seamless across every IDE and machine",
  "Entire team shares the same knowledge",
  "Every decision remembered and tracked",
  "Architecture understood automatically",
];

export function BeforeAfter() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const before = beforeRef.current;
      const after = afterRef.current;
      const line = lineRef.current;
      if (!section || !before || !after || !line) return;

      gsap.fromTo(
        before,
        { opacity: 1, y: 0, scale: 1 },
        {
          opacity: 0.3,
          y: 20,
          scale: 0.97,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top center",
            end: "bottom center",
            scrub: true,
          },
        },
      );

      gsap.fromTo(
        after,
        { opacity: 0.4, y: 30, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top center",
            end: "bottom center",
            scrub: true,
          },
        },
      );

      gsap.fromTo(
        line,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top center",
            end: "bottom center",
            scrub: true,
          },
        },
      );
    },
    { scope: sectionRef },
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

      <section
        ref={sectionRef}
        className="relative overflow-hidden py-28 lg:py-36"
      >
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
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,var(--landing-border)_8px,var(--landing-border)_9px)] [mask-image:radial-gradient(ellipse_50%_45%_at_50%_50%,black_30%,transparent_70%)] opacity-[0.18]"
          aria-hidden="true"
        />
        {/* Indigo glow */}
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.03] blur-[100px]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-block font-mono text-[11px] font-medium text-[#F97316] uppercase">
              The problem
            </span>
            <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-bold">
              AI context resets every session
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--landing-text-secondary)]">
              Without persistent context, your agents waste time re-learning
              what they already knew.
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Connecting line */}
            <div
              ref={lineRef}
              className="pointer-events-none absolute top-1/2 left-1/2 z-10 hidden h-px w-16 origin-left -translate-x-1/2 -translate-y-1/2 bg-[#F97316] lg:block"
            />

            {/* Without memctl */}
            <div ref={beforeRef}>
              <div className="relative h-full overflow-hidden rounded-xl border border-red-500/20 bg-[var(--landing-surface)] p-8">
                {/* Diagonal hatching */}
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] [mask-image:linear-gradient(to_bottom_right,black_30%,transparent_70%)] opacity-[0.3]"
                  aria-hidden="true"
                />
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="font-mono text-xs text-red-500">
                    Without memctl
                  </span>
                </div>
                <div className="space-y-4">
                  {PAIN_POINTS.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <svg
                        className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span className="text-sm text-[var(--landing-text-secondary)]">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-4">
                  <pre className="font-mono text-xs leading-relaxed text-[var(--landing-text-tertiary)]">
                    {`> Starting new session...\n> Scanning project structure...\n> Reading 847 files...           ⏱ 45s\n> Analyzing dependencies...       ⏱ 12s\n> Building context...             ⏱ 23s\n> Ready.                  Total: 1m 20s`}
                  </pre>
                </div>
              </div>
            </div>

            {/* With memctl */}
            <div ref={afterRef}>
              <div className="relative h-full overflow-hidden rounded-xl border border-emerald-500/20 bg-[var(--landing-surface)] p-8">
                {/* Diagonal hatching */}
                <div
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] [mask-image:linear-gradient(to_bottom_left,black_30%,transparent_70%)] opacity-[0.3]"
                  aria-hidden="true"
                />
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-mono text-xs text-emerald-500">
                    With memctl
                  </span>
                </div>
                <div className="space-y-4">
                  {SOLUTIONS.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <svg
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
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
                      <span className="text-sm text-[var(--landing-text-secondary)]">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-4">
                  <pre className="font-mono text-xs leading-relaxed text-[var(--landing-text-tertiary)]">
                    {`> Starting new session...\n> Loading context from memctl...  ⚡ 12ms\n> 847 memories loaded\n> Branch: feature/auth\n> Team context: synced\n> Ready.                   Total: 12ms`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
