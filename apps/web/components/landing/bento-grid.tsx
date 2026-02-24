"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";
import {
  Brain,
  GitBranch,
  Terminal,
  Users,
  Layers,
  Shield,
  RefreshCw,
  Globe,
} from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const STACK_ICONS = [
  "Next.js",
  "React",
  "Go",
  "Python",
  "Rust",
  "TypeScript",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "Redis",
  "Node.js",
  "Zig",
];

/* ---- Micro-visualizations (SVG, CSS-only) ---- */

function TreeViz() {
  return (
    <svg
      width="160"
      height="120"
      viewBox="0 0 160 120"
      fill="none"
      className="transition-transform duration-500 group-hover:scale-105"
    >
      <circle
        cx="80"
        cy="16"
        r="5"
        fill="#F97316"
        className="animate-node-pulse"
        style={{ "--node-r": 5 } as React.CSSProperties}
      />
      <circle
        cx="40"
        cy="52"
        r="4"
        fill="#F97316"
        opacity="0.7"
        className="animate-node-pulse [animation-delay:400ms]"
        style={{ "--node-r": 4 } as React.CSSProperties}
      />
      <circle
        cx="120"
        cy="52"
        r="4"
        fill="#F97316"
        opacity="0.7"
        className="animate-node-pulse [animation-delay:800ms]"
        style={{ "--node-r": 4 } as React.CSSProperties}
      />
      <circle cx="20" cy="90" r="3" fill="#F97316" opacity="0.7" />
      <circle cx="60" cy="90" r="3" fill="#F97316" opacity="0.7" />
      <circle cx="100" cy="90" r="3" fill="#F97316" opacity="0.7" />
      <circle cx="140" cy="90" r="3" fill="#F97316" opacity="0.7" />
      <line
        x1="80"
        y1="21"
        x2="40"
        y2="48"
        stroke="#F97316"
        strokeWidth="1"
        opacity="0.5"
      />
      <line
        x1="80"
        y1="21"
        x2="120"
        y2="48"
        stroke="#F97316"
        strokeWidth="1"
        opacity="0.5"
      />
      <line
        x1="40"
        y1="56"
        x2="20"
        y2="87"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="40"
        y1="56"
        x2="60"
        y2="87"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="120"
        y1="56"
        x2="100"
        y2="87"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="120"
        y1="56"
        x2="140"
        y2="87"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
    </svg>
  );
}

function GitBranchViz() {
  return (
    <svg
      width="140"
      height="60"
      viewBox="0 0 140 60"
      fill="none"
      className="transition-transform duration-500 group-hover:scale-105"
    >
      <line
        x1="10"
        y1="30"
        x2="130"
        y2="30"
        stroke="#F97316"
        strokeWidth="2"
        opacity="0.5"
      />
      <path
        d="M40 30 Q55 10 70 10 Q85 10 100 30"
        stroke="#F97316"
        strokeWidth="1.5"
        opacity="0.4"
        fill="none"
      />
      <circle cx="30" cy="30" r="3" fill="#F97316" opacity="0.7" />
      <circle cx="60" cy="30" r="3" fill="#F97316" opacity="0.7" />
      <circle cx="70" cy="10" r="3" fill="#F97316" opacity="0.6" />
      <circle cx="100" cy="30" r="3" fill="#F97316" opacity="0.7" />
      <circle r="3" fill="#F97316">
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path="M10,30 L130,30"
        />
      </circle>
    </svg>
  );
}

function MCPViz() {
  return (
    <svg
      width="140"
      height="60"
      viewBox="0 0 140 60"
      fill="none"
      className="transition-transform duration-500 group-hover:scale-105"
    >
      <rect
        x="4"
        y="15"
        width="40"
        height="30"
        rx="4"
        stroke="#F97316"
        strokeWidth="1"
        opacity="0.5"
        fill="none"
      />
      <text
        x="24"
        y="34"
        textAnchor="middle"
        fill="#F97316"
        fontSize="8"
        opacity="0.7"
        fontFamily="monospace"
      >
        Agent
      </text>
      <rect
        x="96"
        y="15"
        width="40"
        height="30"
        rx="4"
        stroke="#F97316"
        strokeWidth="1"
        opacity="0.5"
        fill="none"
      />
      <text
        x="116"
        y="34"
        textAnchor="middle"
        fill="#F97316"
        fontSize="8"
        opacity="0.7"
        fontFamily="monospace"
      >
        memctl
      </text>
      <line
        x1="48"
        y1="25"
        x2="92"
        y2="25"
        stroke="#F97316"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="92"
        y1="35"
        x2="48"
        y2="35"
        stroke="#F97316"
        strokeWidth="1"
        opacity="0.4"
      />
      <circle r="2.5" fill="#F97316" opacity="0.8">
        <animateMotion dur="2s" repeatCount="indefinite" path="M48,25 L92,25" />
      </circle>
      <circle r="2.5" fill="#4ADE80" opacity="0.8">
        <animateMotion
          dur="2.5s"
          repeatCount="indefinite"
          path="M92,35 L48,35"
        />
      </circle>
    </svg>
  );
}

function IndexingViz() {
  return (
    <svg
      width="160"
      height="80"
      viewBox="0 0 160 80"
      fill="none"
      className="transition-transform duration-500 group-hover:scale-105"
    >
      <circle cx="30" cy="20" r="4" fill="#F97316" opacity="0.6" />
      <circle cx="80" cy="15" r="5" fill="#F97316" opacity="0.7" />
      <circle cx="130" cy="25" r="4" fill="#F97316" opacity="0.6" />
      <circle cx="50" cy="55" r="3.5" fill="#F97316" opacity="0.5" />
      <circle cx="110" cy="60" r="3.5" fill="#F97316" opacity="0.5" />
      <line
        x1="30"
        y1="20"
        x2="80"
        y2="15"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="80"
        y1="15"
        x2="130"
        y2="25"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="30"
        y1="20"
        x2="50"
        y2="55"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="130"
        y1="25"
        x2="110"
        y2="60"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="50"
        y1="55"
        x2="110"
        y2="60"
        stroke="#F97316"
        strokeWidth="0.7"
        opacity="0.4"
      />
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="80"
        stroke="#F97316"
        strokeWidth="1.5"
        opacity="0"
      >
        <animate
          attributeName="x1"
          values="0;160;0"
          dur="4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="x2"
          values="0;160;0"
          dur="4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0.5;0"
          dur="4s"
          repeatCount="indefinite"
        />
      </line>
    </svg>
  );
}

function TimelineViz() {
  return (
    <svg
      width="140"
      height="50"
      viewBox="0 0 140 50"
      fill="none"
      className="transition-transform duration-500 group-hover:scale-105"
    >
      <line
        x1="10"
        y1="25"
        x2="130"
        y2="25"
        stroke="#F97316"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <circle cx="25" cy="25" r="3" fill="#F97316" opacity="0.5" />
      <circle cx="55" cy="25" r="3" fill="#F97316" opacity="0.6" />
      <circle cx="85" cy="25" r="3" fill="#F97316" opacity="0.7" />
      <circle cx="115" cy="25" r="3" fill="#F97316" opacity="0.8" />
      <g>
        <rect
          x="100"
          y="6"
          width="30"
          height="14"
          rx="3"
          fill="#F97316"
          opacity="0.25"
        />
        <text
          x="115"
          y="16"
          textAnchor="middle"
          fill="#F97316"
          fontSize="8"
          fontFamily="monospace"
          opacity="0.9"
        >
          HEAD
        </text>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0;15,0;0,0"
          dur="4s"
          repeatCount="indefinite"
        />
      </g>
    </svg>
  );
}

/* ---- Animated Indexing Terminal ---- */

const INDEXING_LINES = [
  { prefix: "$", text: " memctl index --verbose", color: "text-[#F97316]" },
  { prefix: "✓", text: " 847 files scanned", color: "text-emerald-500" },
  { prefix: "✓", text: " 23 modules mapped", color: "text-emerald-500" },
  {
    prefix: "✓",
    text: " 156 cross-file deps found",
    color: "text-emerald-500",
  },
  { prefix: "✓", text: " 42 patterns detected", color: "text-emerald-500" },
  {
    prefix: " ",
    text: " Index complete → 1,068 memories",
    color: "text-[var(--landing-text-tertiary)]",
  },
];

function IndexingTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= INDEXING_LINES.length) clearInterval(interval);
    }, 400);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <div
      ref={ref}
      className="mt-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-4"
    >
      <pre className="font-mono text-[11px] leading-[1.7] text-[var(--landing-text-tertiary)]">
        {INDEXING_LINES.map((line, i) => (
          <motion.span
            key={i}
            className="block"
            initial={{ opacity: 0, x: -8 }}
            animate={i < visibleCount ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <span className={line.color}>{line.prefix}</span>
            {line.text}
          </motion.span>
        ))}
        {/* Blinking cursor on the last visible line */}
        {visibleCount > 0 && visibleCount < INDEXING_LINES.length && (
          <motion.span
            className="inline-block h-3 w-1.5 bg-[#F97316]"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
              times: [0, 0.49, 0.5, 1],
            }}
          />
        )}
      </pre>
    </div>
  );
}

/* ---- Animated Version Timeline ---- */

const COMMITS = [
  { hash: "a3f8c21", msg: "refactor: extract auth module", time: "2m ago" },
  { hash: "b7e1d04", msg: "feat: add rate limiting", time: "1h ago" },
  { hash: "c9a2f18", msg: "fix: session timeout handling", time: "3h ago" },
];

function VersionTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    if (!isInView) return;
    let idx = 0;
    const timeout = setTimeout(
      () => {
        setActiveIdx(0);
        const interval = setInterval(() => {
          idx = (idx + 1) % COMMITS.length;
          setActiveIdx(idx);
        }, 2500);
        return () => clearInterval(interval);
      },
      COMMITS.length * 200 + 400,
    );
    return () => clearTimeout(timeout);
  }, [isInView]);

  return (
    <div ref={ref} className="mt-auto space-y-2">
      {COMMITS.map((commit, i) => (
        <motion.div
          key={commit.hash}
          initial={{ opacity: 0, x: -16 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{
            delay: i * 0.2,
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-500 ${
            activeIdx === i
              ? "border-[#F97316]/30 bg-[#F97316]/[0.04]"
              : "border-[var(--landing-border)] bg-[var(--landing-code-bg)]"
          }`}
        >
          <span className="font-mono text-[11px] text-[#F97316]">
            {commit.hash}
          </span>
          <span className="flex-1 truncate font-mono text-[11px] text-[var(--landing-text-secondary)]">
            {commit.msg}
          </span>
          <motion.span
            className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-500"
            animate={activeIdx === i ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={
                activeIdx === i
                  ? { scale: [1, 1.8, 1], opacity: [1, 0.5, 1] }
                  : { scale: 1, opacity: 0.7 }
              }
              transition={{
                duration: 1.2,
                repeat: activeIdx === i ? Infinity : 0,
                ease: "easeInOut",
              }}
            />
            synced
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

/* ---- Bento Card ---- */

interface BentoCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  visualization?: React.ReactNode;
  className?: string;
}

function BentoCard({
  icon: Icon,
  title,
  description,
  visualization,
  className = "",
}: BentoCardProps) {
  return (
    <div
      className={`glass-border group relative flex h-full flex-col overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] ${className}`}
    >
      {/* Diagonal hatching pattern */}
      <div
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,var(--landing-border)_4px,var(--landing-border)_5px)] [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)] opacity-[0.35] transition-opacity duration-300 group-hover:opacity-[0.5]"
        aria-hidden="true"
      />
      {visualization && (
        <div className="pointer-events-none absolute top-4 right-4 opacity-[0.45] transition-opacity duration-300 group-hover:opacity-75">
          {visualization}
        </div>
      )}

      <div className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface-2)] transition-colors duration-300 group-hover:border-[#F97316]/30 group-hover:bg-[#F97316]/5">
        <Icon className="h-5 w-5 text-[#F97316]" strokeWidth={1.5} />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--landing-text)]">
        {title}
      </h3>
      <p className="flex-1 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
        {description}
      </p>
    </div>
  );
}

/* ---- Stack Card ---- */

function StackCard() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-7">
      {/* Diagonal hatching */}
      <div
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,var(--landing-border)_6px,var(--landing-border)_7px)] [mask-image:linear-gradient(to_right,black_15%,transparent_40%,transparent_60%,black_85%)] opacity-[0.2] transition-opacity duration-300 group-hover:opacity-[0.35]"
        aria-hidden="true"
      />
      {/* Shimmer sweep on hover */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#F97316]/[0.03] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
          <Globe className="h-5 w-5 text-[#F97316]" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-[var(--landing-text)]">
          Works with your entire stack
        </h3>
      </div>
      <div className="flex flex-wrap gap-3">
        {STACK_ICONS.map((name) => (
          <span
            key={name}
            className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface-2)] px-4 py-2 font-mono text-xs font-medium text-[var(--landing-text-tertiary)] transition-colors hover:border-[#F97316]/30 hover:text-[var(--landing-text-secondary)]"
          >
            {name}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm text-[var(--landing-text-tertiary)]">
        And any tool that supports MCP.
      </p>
    </div>
  );
}

/* ---- Bento Grid ---- */

/*
  Desktop layout (4 cols, explicit row placement):
  Row 1-2: [Project Memory 2x2] [GitHub 1x1     ] [MCP 1x1      ]
                                 [Team 1x1       ] [Policies 1x1  ]
  Row 3:   [Smart Indexing 2x1                ] [Version-aware 2x1]
  Row 4:   [Stack compatibility - full width 4x1                  ]
*/

export function BentoGrid() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
      style={{ gridAutoRows: "auto" }}
    >
      {/* Project Memory - large feature card (2x2 on desktop) */}
      <ScrollReveal
        animation="scale-up"
        className="md:col-span-2 lg:col-span-2 lg:row-span-2"
        style={{ display: "flex" }}
      >
        <BentoCard
          icon={Brain}
          title="Project-wide memory"
          description="Agents learn your project's architecture, file structure, naming conventions, and decision history. Every pattern, every convention, every decision, remembered and shared."
          visualization={<TreeViz />}
        />
      </ScrollReveal>

      {/* GitHub - top right */}
      <ScrollReveal animation="fade-up" delay={100} style={{ display: "flex" }}>
        <BentoCard
          icon={GitBranch}
          title="GitHub-native"
          description="Connects directly to your repositories. Auto-indexes on push."
          visualization={<GitBranchViz />}
        />
      </ScrollReveal>

      {/* MCP - top right */}
      <ScrollReveal animation="fade-up" delay={200} style={{ display: "flex" }}>
        <BentoCard
          icon={Terminal}
          title="MCP Protocol"
          description="Works with any agent that speaks MCP. Claude Code, Cursor, Windsurf, and more."
          visualization={<MCPViz />}
        />
      </ScrollReveal>

      {/* Team - below GitHub */}
      <ScrollReveal animation="fade-up" delay={150} style={{ display: "flex" }}>
        <BentoCard
          icon={Users}
          title="Team sync"
          description={
            'Every team member\'s agents share the same context. No more "works on my machine" for AI.'
          }
        />
      </ScrollReveal>

      {/* Policies - below MCP */}
      <ScrollReveal animation="fade-up" delay={250} style={{ display: "flex" }}>
        <BentoCard
          icon={Shield}
          title="Org-level policies"
          description="Set organization-wide rules: coding standards, security patterns, forbidden patterns."
        />
      </ScrollReveal>

      {/* Smart Indexing - 2 col span, enriched layout */}
      <ScrollReveal
        animation="slide-left"
        delay={200}
        className="lg:col-span-2"
        style={{ display: "flex" }}
      >
        <div className="glass-border group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_var(--landing-glow)]">
          {/* Diagonal hatching */}
          <div
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] [mask-image:linear-gradient(to_bottom_left,black_30%,transparent_70%)] opacity-[0.3] transition-opacity duration-300 group-hover:opacity-[0.45]"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute top-4 right-4 opacity-[0.45] transition-opacity duration-300 group-hover:opacity-75">
            <IndexingViz />
          </div>
          <div className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface-2)] transition-colors duration-300 group-hover:border-[#F97316]/30 group-hover:bg-[#F97316]/5">
            <Layers className="h-5 w-5 text-[#F97316]" strokeWidth={1.5} />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[var(--landing-text)]">
            Smart indexing
          </h3>
          <p className="mb-5 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
            memctl doesn&apos;t just store files. It understands relationships,
            dependencies, and patterns across your entire codebase.
          </p>
          <IndexingTerminal />
        </div>
      </ScrollReveal>

      {/* Version-aware - 2 col span, enriched layout */}
      <ScrollReveal
        animation="slide-right"
        delay={300}
        className="lg:col-span-2"
        style={{ display: "flex" }}
      >
        <div className="glass-border group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_var(--landing-glow)]">
          {/* Diagonal hatching */}
          <div
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] [mask-image:linear-gradient(to_bottom_right,black_30%,transparent_70%)] opacity-[0.3] transition-opacity duration-300 group-hover:opacity-[0.45]"
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute top-4 right-4 opacity-[0.45] transition-opacity duration-300 group-hover:opacity-75">
            <TimelineViz />
          </div>
          <div className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface-2)] transition-colors duration-300 group-hover:border-[#F97316]/30 group-hover:bg-[#F97316]/5">
            <RefreshCw className="h-5 w-5 text-[#F97316]" strokeWidth={1.5} />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[var(--landing-text)]">
            Version-aware
          </h3>
          <p className="mb-5 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
            Memory updates with your code. When you refactor, memctl knows. No
            stale context, no outdated suggestions.
          </p>
          <VersionTimeline />
        </div>
      </ScrollReveal>

      {/* Full-width stack card */}
      <ScrollReveal
        animation="fade-up"
        delay={350}
        className="md:col-span-2 lg:col-span-4"
        style={{ display: "flex" }}
      >
        <StackCard />
      </ScrollReveal>
    </div>
  );
}
