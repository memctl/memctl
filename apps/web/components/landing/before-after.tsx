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
        }
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
        }
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
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-[var(--landing-border)] py-28 lg:py-36"
    >
      <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
        <div className="mb-16 text-center">
          <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
            The problem
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1]">
            AI context resets every session
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--landing-text-secondary)]">
            Without persistent context, your agents waste time re-learning what
            they already knew.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Connecting line */}
          <div
            ref={lineRef}
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-px w-16 -translate-x-1/2 -translate-y-1/2 origin-left bg-[#F97316] lg:block"
          />

          {/* Without memctl */}
          <div ref={beforeRef}>
            <div className="h-full rounded-xl border border-red-500/20 bg-[var(--landing-surface)] p-8">
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
            <div className="h-full rounded-xl border border-emerald-500/20 bg-[var(--landing-surface)] p-8">
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
  );
}
