"use client";

import { SectionLabel } from "@/components/dashboard/shared/section-label";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface UsageChartsProps {
  memoryByProject: { name: string; count: number }[];
}

// Mock data for API call trends (last 30 days)
function generateMockApiData() {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      calls: Math.floor(Math.random() * 500) + 50,
    });
  }
  return data;
}

const apiCallData = generateMockApiData();

const areaChartConfig = {
  calls: {
    label: "API Calls",
    color: "#F97316",
  },
} satisfies ChartConfig;

const barChartConfig = {
  count: {
    label: "Memories",
    color: "#F97316",
  },
} satisfies ChartConfig;

export function UsageCharts({ memoryByProject }: UsageChartsProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* API Call Trends */}
      <div>
        <SectionLabel>API Call Trends</SectionLabel>
        <div className="dash-card mt-3 p-5">
          <ChartContainer config={areaChartConfig} className="h-[250px] w-full">
            <AreaChart data={apiCallData}>
              <defs>
                <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--landing-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--landing-text-tertiary)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--landing-text-tertiary)" }}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="calls"
                stroke="#F97316"
                strokeWidth={2}
                fill="url(#orangeGradient)"
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      {/* Memories by Project */}
      <div>
        <SectionLabel>Memories by Project</SectionLabel>
        <div className="dash-card mt-3 p-5">
          {memoryByProject.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center">
              <p className="text-sm text-[var(--landing-text-tertiary)]">
                No projects yet
              </p>
            </div>
          ) : (
            <ChartContainer config={barChartConfig} className="h-[250px] w-full">
              <BarChart data={memoryByProject}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--landing-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--landing-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--landing-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="#F97316"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </div>
  );
}
