"use client";

import { useEffect, useRef, useState } from "react";

interface CommandSequence {
  command: string;
  output: string[];
}

const SEQUENCES: CommandSequence[] = [
  {
    command: "npx memctl auth && npx memctl init",
    output: [
      "\u2713 Authenticated as sarah@acme.dev",
      "\u2713 Organization: acme-corp",
      "\u2713 Project: frontend",
      "\u2713 MCP config written to .claude/settings.json",
      "",
      "Ready. Run `npx memctl serve --mcp` to start.",
    ],
  },
  {
    command: "npx memctl doctor",
    output: [
      "\u2713 Config file found at ~/.memctl/config.json",
      "\u2713 API reachable at https://app.memctl.com",
      "\u2713 Token valid (expires in 29d)",
      "\u2713 Org acme-corp accessible",
      "\u2713 Project frontend accessible",
      "",
      "All checks passed.",
    ],
  },
  {
    command: "npx memctl serve --mcp",
    output: [
      "\u2713 MCP server started on stdio",
      "\u2713 Loaded 186 memory entries",
      "",
      "Listening for agent connections...",
      "  \u2190 Claude Code connected (session f7a2)",
      "  \u2190 Cursor connected (session 3b1c)",
    ],
  },
];

type Phase = "typing" | "output" | "pause" | "clearing";

export function TerminalAnimation() {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typedChars, setTypedChars] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seq = SEQUENCES[sequenceIndex];

  // IntersectionObserver gate
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isVisible) return;

    if (phase === "typing") {
      if (typedChars < seq.command.length) {
        timerRef.current = setTimeout(() => setTypedChars((c) => c + 1), 45);
      } else {
        timerRef.current = setTimeout(() => setPhase("output"), 300);
      }
    } else if (phase === "output") {
      if (visibleLines < seq.output.length) {
        timerRef.current = setTimeout(() => setVisibleLines((l) => l + 1), 120);
      } else {
        timerRef.current = setTimeout(() => setPhase("pause"), 2000);
      }
    } else if (phase === "pause") {
      setPhase("clearing");
    } else if (phase === "clearing") {
      timerRef.current = setTimeout(() => {
        setSequenceIndex((i) => (i + 1) % SEQUENCES.length);
        setPhase("typing");
        setTypedChars(0);
        setVisibleLines(0);
      }, 400);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, phase, typedChars, visibleLines, seq]);

  const fadingOut = phase === "clearing";

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-code-bg)] shadow-2xl"
    >
      {/* macOS title bar */}
      <div className="flex items-center gap-2 border-b border-[var(--landing-border)] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <div className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="mx-auto font-mono text-xs text-[var(--landing-text-tertiary)]">
          Terminal
        </div>
      </div>

      {/* Terminal body */}
      <div
        className="min-h-[280px] p-5 font-mono text-[13px] leading-relaxed transition-opacity duration-300"
        style={{ opacity: fadingOut ? 0 : 1 }}
      >
        {/* Command line */}
        <div className="flex">
          <span className="mr-2 select-none text-[#F97316]">$</span>
          <span className="text-[var(--landing-text)]">
            {seq.command.slice(0, typedChars)}
          </span>
          {phase === "typing" && <span className="terminal-cursor" />}
        </div>

        {/* Output lines */}
        {visibleLines > 0 && (
          <div className="mt-3 space-y-0.5">
            {seq.output.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("\u2713")
                    ? "text-[#4ADE80]"
                    : line.startsWith("←")
                      ? "text-[#60A5FA]"
                      : "text-[var(--landing-text-secondary)]"
                }
              >
                {line || "\u00A0"}
              </div>
            ))}
          </div>
        )}

        {/* Blinking cursor after output */}
        {phase === "output" && visibleLines >= seq.output.length && (
          <div className="mt-2 flex">
            <span className="mr-2 select-none text-[#F97316]">$</span>
            <span className="terminal-cursor" />
          </div>
        )}
        {phase === "pause" && (
          <div className="mt-2 flex">
            <span className="mr-2 select-none text-[#F97316]">$</span>
            <span className="terminal-cursor" />
          </div>
        )}
      </div>
    </div>
  );
}
