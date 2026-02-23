"use client";

import { useMemo, useState } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
} from "recharts";

type Period = "7d" | "30d" | "90d" | "1y" | "all";

interface OverviewChartsProps {
  signupTimestamps: number[];
  orgEntries: {
    createdAt: number;
    effectivePlanId: string;
    contractValue: number | null;
  }[];
  referrerData: { source: string; count: number }[];
  stats: {
    users: number;
    orgs: number;
    projects: number;
    memories: number;
    mrr: number;
    paidOrgs: number;
    activeTrials: number;
  };
  selfHosted: boolean;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  lite: 500,
  pro: 2000,
  business: 5900,
  scale: 14900,
};

const PLAN_COLORS: Record<string, string> = {
  free: "#525252",
  lite: "#3B82F6",
  pro: "#F97316",
  business: "#8B5CF6",
  scale: "#10B981",
  enterprise: "#F59E0B",
};

const REFERRER_COLORS: Record<string, string> = {
  github: "#F97316",
  "twitter/x": "#3B82F6",
  "blog post": "#8B5CF6",
  "friend/colleague": "#10B981",
  search: "#F59E0B",
  other: "#525252",
};

const FALLBACK_COLORS = [
  "#F97316",
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#6366F1",
];

function getPeriodStart(period: Period): number {
  if (period === "all") return 0;
  const now = Date.now();
  const day = 86400000;
  switch (period) {
    case "7d":
      return now - 7 * day;
    case "30d":
      return now - 30 * day;
    case "90d":
      return now - 90 * day;
    case "1y":
      return now - 365 * day;
  }
}

function getGrouping(period: Period): "daily" | "weekly" | "monthly" {
  switch (period) {
    case "7d":
    case "30d":
      return "daily";
    case "90d":
      return "weekly";
    case "1y":
    case "all":
      return "monthly";
  }
}

function getBucketKey(ts: number, grouping: "daily" | "weekly" | "monthly"): string {
  const d = new Date(ts);
  if (grouping === "monthly") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (grouping === "weekly") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBucketLabel(key: string, grouping: "daily" | "weekly" | "monthly"): string {
  if (grouping === "monthly") {
    const [year, month] = key.split("-");
    const d = new Date(Number(year), Number(month) - 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  const [year, month, day] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateBuckets(startMs: number, grouping: "daily" | "weekly" | "monthly"): string[] {
  const buckets: string[] = [];
  const now = new Date();
  const start = startMs === 0 ? new Date(now.getFullYear() - 2, 0, 1) : new Date(startMs);

  if (grouping === "monthly") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= now) {
      buckets.push(getBucketKey(cursor.getTime(), grouping));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else if (grouping === "weekly") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const cursor = new Date(start);
    cursor.setDate(diff);
    while (cursor <= now) {
      buckets.push(getBucketKey(cursor.getTime(), grouping));
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= now) {
      buckets.push(getBucketKey(cursor.getTime(), grouping));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return buckets;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDollarsCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars % 1000 === 0 ? 0 : 1)}K`;
  return `$${dollars.toFixed(0)}`;
}

const signupChartConfig = {
  signups: { label: "Signups", color: "#F97316" },
} satisfies ChartConfig;

const revenueChartConfig = {
  mrr: { label: "MRR", color: "#10B981" },
} satisfies ChartConfig;

export function OverviewCharts({
  signupTimestamps,
  orgEntries,
  referrerData,
  stats,
  selfHosted,
}: OverviewChartsProps) {
  const [period, setPeriod] = useState<Period>("30d");

  const periodStart = useMemo(() => getPeriodStart(period), [period]);
  const grouping = useMemo(() => getGrouping(period), [period]);

  const signupData = useMemo(() => {
    const buckets = generateBuckets(periodStart, grouping);
    const counts: Record<string, number> = {};
    for (const key of buckets) counts[key] = 0;

    for (const ts of signupTimestamps) {
      if (periodStart > 0 && ts < periodStart) continue;
      const key = getBucketKey(ts, grouping);
      if (key in counts) counts[key]++;
    }

    return buckets.map((key) => ({
      label: formatBucketLabel(key, grouping),
      signups: counts[key] ?? 0,
    }));
  }, [signupTimestamps, periodStart, grouping]);

  const revenueData = useMemo(() => {
    if (selfHosted) return [];
    const buckets = generateBuckets(periodStart, grouping);
    const sorted = [...orgEntries].sort((a, b) => a.createdAt - b.createdAt);

    return buckets.map((key) => {
      const bucketEnd = new Date(key);
      if (grouping === "monthly") {
        const [y, m] = key.split("-").map(Number);
        bucketEnd.setFullYear(y, m, 0);
        bucketEnd.setHours(23, 59, 59, 999);
      } else {
        const [y, m, d] = key.split("-").map(Number);
        bucketEnd.setFullYear(y, m - 1, d);
        bucketEnd.setHours(23, 59, 59, 999);
      }
      const endTs = bucketEnd.getTime();

      let mrr = 0;
      for (const org of sorted) {
        if (org.createdAt > endTs) break;
        const planId = org.effectivePlanId;
        if (planId === "enterprise" && org.contractValue) {
          mrr += Math.round(org.contractValue / 12);
        } else {
          mrr += PLAN_PRICES[planId] ?? 0;
        }
      }

      return {
        label: formatBucketLabel(key, grouping),
        mrr,
      };
    });
  }, [orgEntries, periodStart, grouping, selfHosted]);

  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const org of orgEntries) {
      const plan = org.effectivePlanId;
      counts[plan] = (counts[plan] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([plan, count]) => ({
        name: plan,
        value: count,
        fill: PLAN_COLORS[plan] ?? "#525252",
      }))
      .sort((a, b) => b.value - a.value);
  }, [orgEntries]);

  const referrerTotal = useMemo(
    () => referrerData.reduce((sum, r) => sum + r.count, 0),
    [referrerData],
  );

  const referrerEntries = useMemo(
    () =>
      referrerData
        .sort((a, b) => b.count - a.count)
        .map((r, i) => ({
          name: r.source,
          value: r.count,
          fill:
            REFERRER_COLORS[r.source.toLowerCase()] ??
            FALLBACK_COLORS[i % FALLBACK_COLORS.length],
          pct: referrerTotal > 0 ? Math.round((r.count / referrerTotal) * 100) : 0,
        })),
    [referrerData, referrerTotal],
  );

  return (
    <div className="space-y-2">
      {/* ── Stats bento ── */}
      {!selfHosted ? (
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          {/* MRR hero: 2 cols, 2 rows */}
          <div className="col-span-2 row-span-2 dash-card relative overflow-hidden border-l-2 border-l-[#F97316] p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F97316]/[0.04] to-transparent pointer-events-none" />
            <span className="relative block font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Monthly Recurring Revenue
            </span>
            <span className="relative mt-2 block text-4xl font-bold tracking-tight text-[var(--landing-text)]">
              {formatDollars(stats.mrr)}
            </span>
            <div className="relative mt-3 flex items-center gap-4">
              <div>
                <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                  Paid Orgs
                </span>
                <span className="block text-sm font-semibold text-[var(--landing-text)]">
                  {stats.paidOrgs}
                </span>
              </div>
              <div className="h-6 w-px bg-[var(--landing-border)]" />
              <div>
                <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                  Active Trials
                </span>
                <span className="block text-sm font-semibold text-[var(--landing-text)]">
                  {stats.activeTrials}
                </span>
              </div>
            </div>
          </div>
          <StatCard label="Users" value={stats.users.toLocaleString()} />
          <StatCard label="Organizations" value={stats.orgs.toLocaleString()} />
          <StatCard label="Projects" value={stats.projects.toLocaleString()} />
          <StatCard label="Memories" value={stats.memories.toLocaleString()} />
        </div>
      ) : (
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Users" value={stats.users.toLocaleString()} />
          <StatCard label="Organizations" value={stats.orgs.toLocaleString()} />
          <StatCard label="Projects" value={stats.projects.toLocaleString()} />
          <StatCard label="Memories" value={stats.memories.toLocaleString()} />
          <StatCard label="Active Trials" value={stats.activeTrials.toLocaleString()} />
        </div>
      )}

      {/* ── Signups: full width with embedded period selector ── */}
      <div className="dash-card min-w-0 overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
            Signups
          </span>
          <div className="flex items-center gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                  period === p.value
                    ? "bg-[#F97316] text-white"
                    : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <ChartContainer config={signupChartConfig} className="h-[200px] w-full">
          <AreaChart data={signupData}>
            <defs>
              <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--landing-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "var(--landing-text-tertiary)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--landing-text-tertiary)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="signups"
              stroke="#F97316"
              strokeWidth={1.5}
              fill="url(#signupGrad)"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* ── Bottom bento: revenue + donuts ── */}
      {!selfHosted ? (
        <div className="grid gap-2 lg:grid-cols-3">
          {/* Revenue: 2 cols */}
          <div className="lg:col-span-2 dash-card min-w-0 overflow-hidden p-4">
            <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Revenue (MRR)
            </span>
            <ChartContainer config={revenueChartConfig} className="h-[200px] w-full">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--landing-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "var(--landing-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--landing-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                  tickFormatter={(v: number) => formatDollarsCompact(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatDollars(value as number)}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="#10B981"
                  strokeWidth={1.5}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* Plan distribution: 1 col, spans 2 rows */}
          <div className="lg:col-span-1 lg:row-span-2 flex flex-col">
            <div className="dash-card flex flex-1 flex-col p-4">
              <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                Plans
              </span>
              {planDistribution.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                    No organizations yet
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                  <div className="h-[160px] w-[160px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={planDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={72}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {planDistribution.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full space-y-1.5">
                    {planDistribution.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: entry.fill }}
                        />
                        <span className="flex-1 font-mono text-[10px] capitalize text-[var(--landing-text-secondary)]">
                          {entry.name}
                        </span>
                        <span className="font-mono text-[10px] font-medium text-[var(--landing-text)]">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Referrer: 2 cols, horizontal layout */}
          <div className="lg:col-span-2 dash-card min-w-0 overflow-hidden p-4">
            <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Referrers
            </span>
            {referrerEntries.length === 0 ? (
              <div className="flex h-[160px] items-center justify-center">
                <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                  No onboarding data yet
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                <div className="h-[140px] w-[140px] shrink-0 sm:h-[160px] sm:w-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={referrerEntries}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {referrerEntries.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full flex-1 space-y-1.5">
                  {referrerEntries.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="flex-1 font-mono text-[10px] capitalize text-[var(--landing-text-secondary)]">
                        {entry.name}
                      </span>
                      <span className="font-mono text-[10px] font-medium text-[var(--landing-text)]">
                        {entry.value}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                        {entry.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-3">
          <DonutCard
            title="Plans"
            data={planDistribution}
            empty="No organizations yet"
          />
          <div className="lg:col-span-2 dash-card min-w-0 overflow-hidden p-4">
            <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Referrers
            </span>
            {referrerEntries.length === 0 ? (
              <div className="flex h-[160px] items-center justify-center">
                <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                  No onboarding data yet
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                <div className="h-[140px] w-[140px] shrink-0 sm:h-[160px] sm:w-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={referrerEntries}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {referrerEntries.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full flex-1 space-y-1.5">
                  {referrerEntries.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="flex-1 font-mono text-[10px] capitalize text-[var(--landing-text-secondary)]">
                        {entry.name}
                      </span>
                      <span className="font-mono text-[10px] font-medium text-[var(--landing-text)]">
                        {entry.value}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                        {entry.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-card p-3">
      <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
        {label}
      </span>
      <span className="block text-lg font-semibold text-[var(--landing-text)]">
        {value}
      </span>
    </div>
  );
}

function DonutCard({
  title,
  data,
  empty,
}: {
  title: string;
  data: { name: string; value: number; fill: string }[];
  empty: string;
}) {
  return (
    <div className="dash-card p-4">
      <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
        {title}
      </span>
      {data.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center">
          <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">{empty}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="h-[130px] w-[130px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full space-y-1">
            {data.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="flex-1 font-mono text-[10px] capitalize text-[var(--landing-text-secondary)]">
                  {entry.name}
                </span>
                <span className="font-mono text-[10px] font-medium text-[var(--landing-text)]">
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
