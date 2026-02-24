"use client";

import { SectionLabel } from "@/components/dashboard/shared/section-label";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface UsageChartsProps {
  memoryByProject: { name: string; count: number }[];
  activityTrendData: { date: string; writes: number; deletes: number; other: number }[];
  priorityDistribution?: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  tagBreakdown?: { tag: string; count: number }[];
}

const areaChartConfig = {
  writes: { label: "Writes", color: "#F97316" },
  deletes: { label: "Deletes", color: "#EF4444" },
  other: { label: "Other", color: "#3B82F6" },
} satisfies ChartConfig;

const barChartConfig = {
  count: { label: "Memories", color: "#F97316" },
} satisfies ChartConfig;

const COLORS = [
  "#F97316",
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#EF4444",
  "#F59E0B",
  "#EC4899",
  "#6366F1",
];

export function UsageCharts({
  memoryByProject,
  activityTrendData,
  priorityDistribution,
  tagBreakdown,
}: UsageChartsProps) {
  const priorityData = priorityDistribution
    ? [
        {
          name: "High (70-100)",
          value: priorityDistribution.high,
          fill: "#F97316",
        },
        {
          name: "Medium (30-69)",
          value: priorityDistribution.medium,
          fill: "#F59E0B",
        },
        {
          name: "Low (1-29)",
          value: priorityDistribution.low,
          fill: "#3B82F6",
        },
        { name: "None", value: priorityDistribution.none, fill: "#525252" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-4">
      {/* Top row: activity trends + memories by project */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Activity Trends - stacked area chart */}
        <div>
          <SectionLabel>Activity Trends (30d)</SectionLabel>
          <div className="dash-card mt-2 p-4">
            <ChartContainer
              config={areaChartConfig}
              className="h-[220px] w-full"
            >
              <AreaChart data={activityTrendData}>
                <defs>
                  <linearGradient id="writeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="deleteGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="otherGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--landing-border)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "var(--landing-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--landing-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="writes"
                  stroke="#F97316"
                  strokeWidth={1.5}
                  fill="url(#writeGrad)"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="deletes"
                  stroke="#EF4444"
                  strokeWidth={1.5}
                  fill="url(#deleteGrad)"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="other"
                  stroke="#3B82F6"
                  strokeWidth={1.5}
                  fill="url(#otherGrad)"
                  stackId="1"
                />
              </AreaChart>
            </ChartContainer>
            <div className="mt-2 flex items-center justify-center gap-4">
              {Object.entries(areaChartConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    {config.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Memories by Project */}
        <div>
          <SectionLabel>Memories by Project</SectionLabel>
          <div className="dash-card mt-2 p-4">
            {memoryByProject.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center">
                <p className="text-xs text-[var(--landing-text-tertiary)]">
                  No projects yet
                </p>
              </div>
            ) : (
              <ChartContainer
                config={barChartConfig}
                className="h-[220px] w-full"
              >
                <BarChart data={memoryByProject} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--landing-border)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: "var(--landing-text-tertiary)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{
                      fontSize: 10,
                      fill: "var(--landing-text-tertiary)",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="#F97316"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Priority + Tags */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Priority Distribution */}
        {priorityData.length > 0 && (
          <div>
            <SectionLabel>Priority Distribution</SectionLabel>
            <div className="dash-card mt-2 p-4">
              <div className="flex items-center gap-6">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {priorityData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {priorityData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="flex-1 font-mono text-[10px] text-[var(--landing-text-secondary)]">
                        {entry.name}
                      </span>
                      <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Tags */}
        {tagBreakdown && tagBreakdown.length > 0 && (
          <div>
            <SectionLabel>Tag Usage (Top 15)</SectionLabel>
            <div className="dash-card mt-2 p-4">
              <div className="space-y-1.5">
                {tagBreakdown.slice(0, 15).map((t, i) => {
                  const maxCount = tagBreakdown[0]?.count ?? 1;
                  const pct = Math.round((t.count / maxCount) * 100);
                  return (
                    <div key={t.tag} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate font-mono text-[10px] text-[var(--landing-text-secondary)]">
                        {t.tag}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--landing-surface-2)]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                        {t.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
