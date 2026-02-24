"use client";

import { motion, useInView, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect } from "react";

/* ---- Data ---- */

const LINE_DATA = [
  { day: "Mon", value: 120 },
  { day: "Tue", value: 340 },
  { day: "Wed", value: 280 },
  { day: "Thu", value: 520 },
  { day: "Fri", value: 410 },
  { day: "Sat", value: 680 },
  { day: "Sun", value: 590 },
];

const BAR_DATA = [
  { label: "Architecture", pct: 34, color: "#F97316" },
  { label: "Conventions", pct: 28, color: "#FB923C" },
  { label: "Patterns", pct: 22, color: "#FDBA74" },
  { label: "Infrastructure", pct: 16, color: "#FED7AA" },
];

const ACTIVITIES = [
  { file: "auth/session.ts", action: "indexed", time: "2s ago" },
  { file: "api/routes.ts", action: "updated", time: "15s ago" },
  { file: "db/schema.ts", action: "migrated", time: "1m ago" },
  { file: "config/env.ts", action: "indexed", time: "2m ago" },
];

const STATS = [
  { value: 12, suffix: "ms", label: "Avg latency" },
  { value: 99.9, suffix: "%", label: "Uptime" },
  { value: 50, suffix: "K+", label: "Memories" },
  { value: 2847, suffix: "", label: "Auto-indexed" },
];

/* ---- Helpers ---- */

const W = 400;
const H = 200;
const PAD = 40;

function getPoints() {
  const max = Math.max(...LINE_DATA.map((d) => d.value));
  return LINE_DATA.map((d, i) => ({
    x: PAD + (i / (LINE_DATA.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - d.value / max) * (H - PAD * 2),
    ...d,
  }));
}

function buildSmoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/* ---- Animated Counter ---- */

function AnimCounter({
  target,
  suffix = "",
}: {
  target: number;
  suffix: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!isInView || started.current) return;
    started.current = true;
    const start = performance.now();
    const dur = 1400;
    let rafId: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;

    const animate = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setCount(Number((eased * target).toFixed(target % 1 !== 0 ? 1 : 0)));
      if (t < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    // After initial animation, start fluctuation (skip for percentages)
    if (suffix !== "%") {
      timeoutId = setTimeout(() => {
        intervalId = setInterval(() => {
          const fluctuation = 1 + (Math.random() * 0.04 - 0.02);
          setCount(
            Number((target * fluctuation).toFixed(target % 1 !== 0 ? 1 : 0)),
          );
        }, 3000);
      }, 1400);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [isInView, target, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ---- Line Chart ---- */

function AnimatedLineChart() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });
  const [hovered, setHovered] = useState<number | null>(null);
  const points = getPoints();
  const linePath = buildSmoothPath(points);
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const areaPath = `${linePath} L${lastPt.x},${H - PAD} L${firstPt.x},${H - PAD} Z`;

  return (
    <div ref={ref} className="relative">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-[var(--landing-text-secondary)]">
          Queries this week
        </span>
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 1.8 }}
          >
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-mono text-[10px] text-emerald-500">Live</span>
          </motion.div>
          <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
            Last 7 days
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={PAD}
            y1={PAD + frac * (H - PAD * 2)}
            x2={W - PAD}
            y2={PAD + frac * (H - PAD * 2)}
            stroke="var(--landing-border)"
            strokeWidth="0.5"
          />
        ))}

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill="url(#areaGrad)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
        />

        {/* Animated line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="#F97316"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={isInView ? { pathLength: 1 } : {}}
          transition={{ duration: 1.8, ease: "easeOut" }}
        />

        {/* Continuous glow pulse overlay */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="#F97316"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: [0, 0.3, 0] } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: 1.8,
            ease: "easeInOut",
          }}
        />

        {/* Traveling dot along the curve */}
        {isInView && (
          <g>
            <circle r="10" fill="#F97316" opacity="0.12">
              <animateMotion
                dur="4s"
                repeatCount="indefinite"
                path={linePath}
              />
            </circle>
            <circle r="4" fill="#F97316" opacity="0.9">
              <animateMotion
                dur="4s"
                repeatCount="indefinite"
                path={linePath}
              />
            </circle>
          </g>
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Glow ring on hover */}
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={12}
              fill="#F97316"
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered === i ? 0.1 : 0 }}
              transition={{ duration: 0.2 }}
            />
            {/* Point */}
            <motion.circle
              cx={p.x}
              cy={p.y}
              fill="#F97316"
              initial={{ r: 0, opacity: 0 }}
              animate={isInView ? { r: hovered === i ? 6 : 4, opacity: 1 } : {}}
              transition={{
                r: { type: "spring", stiffness: 400, damping: 20 },
                opacity: { duration: 0.3, delay: 0.8 + i * 0.12 },
                default: { delay: 0.8 + i * 0.12 },
              }}
            />
            {/* Hit area */}
            <circle
              cx={p.x}
              cy={p.y}
              r={18}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => (
          <text
            key={`label-${i}`}
            x={p.x}
            y={H - 10}
            textAnchor="middle"
            fill="var(--landing-text-tertiary)"
            fontSize="11"
            fontFamily="var(--font-mono)"
          >
            {p.day}
          </text>
        ))}

        {/* Tooltip */}
        <AnimatePresence>
          {hovered !== null && (
            <motion.g
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
            >
              <rect
                x={points[hovered].x - 30}
                y={points[hovered].y - 34}
                width="60"
                height="24"
                rx="6"
                fill="var(--landing-surface)"
                stroke="var(--landing-border)"
                strokeWidth="1"
              />
              <text
                x={points[hovered].x}
                y={points[hovered].y - 18}
                textAnchor="middle"
                fill="#F97316"
                fontSize="12"
                fontWeight="600"
                fontFamily="var(--font-mono)"
              >
                {LINE_DATA[hovered].value}
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}

/* ---- Bar Chart ---- */

function AnimatedBarChart() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });
  const [liveData, setLiveData] = useState(BAR_DATA);
  const [settled, setSettled] = useState(false);
  const maxPct = Math.max(...liveData.map((d) => d.pct));

  useEffect(() => {
    if (!isInView) return;
    let intervalId: ReturnType<typeof setInterval>;

    const delay = setTimeout(() => {
      setSettled(true);
      intervalId = setInterval(() => {
        setLiveData(() => {
          const raw = BAR_DATA.map((bar) => ({
            ...bar,
            pct: bar.pct + (Math.random() * 8 - 4),
          }));
          const total = raw.reduce((s, b) => s + b.pct, 0);
          return raw.map((b) => ({
            ...b,
            pct: Math.round((b.pct / total) * 100),
          }));
        });
      }, 3000);
    }, 1500);

    return () => {
      clearTimeout(delay);
      clearInterval(intervalId);
    };
  }, [isInView]);

  return (
    <div ref={ref}>
      <div className="mb-4 font-mono text-xs font-medium text-[var(--landing-text-secondary)]">
        Memory distribution
      </div>
      <div className="space-y-3.5">
        {liveData.map((bar, i) => (
          <div key={bar.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-[var(--landing-text-secondary)]">
                {bar.label}
              </span>
              <motion.span
                className="font-mono text-xs tabular-nums text-[var(--landing-text-tertiary)]"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: settled ? 0 : 0.6 + i * 0.15 }}
              >
                {bar.pct}%
              </motion.span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--landing-surface-2)]">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: bar.color }}
                initial={{ width: "0%" }}
                animate={
                  isInView ? { width: `${(bar.pct / maxPct) * 100}%` } : {}
                }
                transition={
                  settled
                    ? { duration: 0.8, ease: "easeInOut" }
                    : {
                        duration: 1,
                        delay: 0.3 + i * 0.15,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }
                }
                whileHover={{ filter: "brightness(1.15)" }}
              />
              {/* Shimmer overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: "-100%" }}
                animate={isInView ? { x: ["-100%", "200%"] } : {}}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 3,
                  delay: 1.3 + i * 0.15,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Activity Feed ---- */

function ActivityFeed() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    if (!isInView) return;
    let intervalId: ReturnType<typeof setInterval>;

    const delay = setTimeout(
      () => {
        let idx = 0;
        setActiveIdx(0);
        intervalId = setInterval(() => {
          idx = (idx + 1) % ACTIVITIES.length;
          setActiveIdx(idx);
        }, 2000);
      },
      ACTIVITIES.length * 150 + 500,
    );

    return () => {
      clearTimeout(delay);
      clearInterval(intervalId);
    };
  }, [isInView]);

  return (
    <div ref={ref}>
      <div className="mb-3 font-mono text-xs font-medium text-[var(--landing-text-secondary)]">
        Recent activity
      </div>
      <div className="space-y-2">
        {ACTIVITIES.map((item, i) => (
          <motion.div
            key={item.file}
            initial={{ opacity: 0, x: -12 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{
              delay: i * 0.15,
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-500 ${
              activeIdx === i
                ? "border-[#F97316]/30 bg-[#F97316]/[0.04]"
                : "border-[var(--landing-border)] bg-[var(--landing-surface-2)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <motion.span
                className="inline-block h-1.5 w-1.5 rounded-full bg-[#F97316]"
                animate={
                  activeIdx === i
                    ? { scale: [1, 1.8, 1], opacity: [1, 0.5, 1] }
                    : { scale: 1, opacity: 0.5 }
                }
                transition={{
                  duration: 1,
                  repeat: activeIdx === i ? Infinity : 0,
                  ease: "easeInOut",
                }}
              />
              <span className="font-mono text-[11px] text-[var(--landing-text)]">
                {item.file}
              </span>
              <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                {item.action}
              </span>
            </div>
            <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {item.time}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---- Combined Chart Section ---- */

export function AnimatedChart() {
  return (
    <div className="space-y-6">
      {/* Top row: Line chart + Bar chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="h-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <AnimatedLineChart />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{
            duration: 0.7,
            delay: 0.1,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <div className="h-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <AnimatedBarChart />
          </div>
        </motion.div>
      </div>

      {/* Bottom row: Stats + Activity feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Stats grid - 4 inline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="grid h-full grid-cols-2 gap-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="flex flex-col items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: 0.3 + i * 0.1,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
                whileHover={{
                  borderColor: "rgba(249, 115, 22, 0.3)",
                  transition: { duration: 0.2 },
                }}
              >
                <div className="font-mono text-2xl font-bold text-[#F97316]">
                  <AnimCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="mt-1 text-xs text-[var(--landing-text-tertiary)]">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <div className="h-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <ActivityFeed />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
