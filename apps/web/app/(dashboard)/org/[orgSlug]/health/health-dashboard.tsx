"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, AlertTriangle, XCircle, Brain, Pin, Archive, Clock,
  GitBranch, Zap, Webhook, Lock, Database, Tag, BarChart3, FolderOpen,
} from "lucide-react";

interface HealthCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

interface HealthDashboardProps {
  checks: HealthCheck[];
  stats: {
    totalMemories: number;
    totalVersions: number;
    totalPinned: number;
    totalArchived: number;
    totalExpiring: number;
    totalSessions: number;
    totalActivities: number;
    totalWebhooks: number;
    totalPendingWebhookEvents: number;
    totalActiveLocks: number;
    memoryLimit: number | null;
    usagePercent: number;
  };
  priorityBuckets: { high: number; medium: number; low: number; none: number };
  topTags: { tag: string; count: number }[];
  projectStats: Array<{
    name: string;
    slug: string;
    memoryCount: number;
    pinnedCount: number;
    archivedCount: number;
    sessionCount: number;
    activityCount: number;
  }>;
  planName: string;
  orgSlug: string;
}

const statusIcons = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  fail: <XCircle className="h-4 w-4 text-red-400" />,
};

const statusColors = {
  pass: "border-emerald-500/20 bg-emerald-500/5",
  warn: "border-amber-500/20 bg-amber-500/5",
  fail: "border-red-500/20 bg-red-500/5",
};

export function HealthDashboard({
  checks, stats, priorityBuckets, topTags, projectStats, planName,
}: HealthDashboardProps) {
  const totalPriorityCount = priorityBuckets.high + priorityBuckets.medium + priorityBuckets.low + priorityBuckets.none;
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;

  return (
    <TooltipProvider delayDuration={200}>
      <div>
        {/* Health Checks */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">System Checks</span>
            <div className="flex items-center gap-1.5 ml-auto">
              {passCount > 0 && <span className="font-mono text-[10px] text-emerald-400">{passCount} pass</span>}
              {warnCount > 0 && <span className="font-mono text-[10px] text-amber-400">{warnCount} warn</span>}
              {failCount > 0 && <span className="font-mono text-[10px] text-red-400">{failCount} fail</span>}
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((check) => (
              <div key={check.name} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${statusColors[check.status]}`}>
                {statusIcons[check.status]}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] font-medium text-[var(--landing-text)]">{check.name}</div>
                  <div className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Capacity */}
        <div className="mb-4 dash-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">Memory Capacity</span>
            <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">{planName} Plan</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress
                value={stats.usagePercent}
                className={`h-3 bg-[var(--landing-surface-2)] [&>div]:transition-all [&>div]:duration-500 ${
                  stats.usagePercent >= 95 ? "[&>div]:bg-red-500" : stats.usagePercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-[#F97316]"
                }`}
              />
            </div>
            <span className="font-mono text-sm font-bold text-[var(--landing-text)]">
              {stats.usagePercent}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] font-mono text-[var(--landing-text-tertiary)]">
            <span>{stats.totalMemories.toLocaleString()} memories</span>
            <span>Limit: {stats.memoryLimit?.toLocaleString() ?? "∞"}</span>
            <span>{stats.totalVersions.toLocaleString()} versions</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { icon: Brain, label: "Active", value: stats.totalMemories - stats.totalArchived, color: "text-[var(--landing-text)]" },
            { icon: Pin, label: "Pinned", value: stats.totalPinned, color: "text-[#F97316]" },
            { icon: Archive, label: "Archived", value: stats.totalArchived, color: "text-[var(--landing-text-tertiary)]" },
            { icon: Clock, label: "Expiring", value: stats.totalExpiring, color: "text-amber-400" },
            { icon: Zap, label: "Sessions", value: stats.totalSessions, color: "text-blue-400" },
            { icon: Database, label: "Activities", value: stats.totalActivities, color: "text-emerald-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="dash-card p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3 w-3 ${color}`} />
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">{label}</span>
              </div>
              <div className={`font-mono text-lg font-bold ${color}`}>{value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Priority Distribution */}
          <div className="dash-card p-4">
            <div className="font-mono text-xs font-medium text-[var(--landing-text)] mb-3">Priority Distribution</div>
            <div className="space-y-2">
              {[
                { label: "High (70-100)", value: priorityBuckets.high, color: "bg-[#F97316]" },
                { label: "Medium (30-69)", value: priorityBuckets.medium, color: "bg-amber-500" },
                { label: "Low (1-29)", value: priorityBuckets.low, color: "bg-blue-500" },
                { label: "None (0)", value: priorityBuckets.none, color: "bg-[var(--landing-text-tertiary)]" },
              ].map(({ label, value, color }) => {
                const pct = totalPriorityCount > 0 ? Math.round((value / totalPriorityCount) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[var(--landing-text-secondary)] w-24 shrink-0">{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--landing-surface-2)] overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)] w-12 text-right">{value} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Tags */}
          <div className="dash-card p-4">
            <div className="font-mono text-xs font-medium text-[var(--landing-text)] mb-3">Top Tags</div>
            {topTags.length === 0 ? (
              <p className="text-xs text-[var(--landing-text-tertiary)]">No tags found</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {topTags.map(({ tag, count }) => (
                  <Tooltip key={tag}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--landing-surface-2)] px-2 py-1 font-mono text-[10px] text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)] transition-colors cursor-default">
                        <Tag className="h-2.5 w-2.5 text-[#F97316]" />{tag}
                        <span className="text-[var(--landing-text-tertiary)]">{count}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">{count} memor{count === 1 ? "y" : "ies"} tagged "{tag}"</p></TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Project Breakdown */}
        <div className="mt-4 dash-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">Project Breakdown</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Project</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] text-right">Memories</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] text-right">Pinned</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] text-right">Archived</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] text-right">Sessions</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] text-right">Actions</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectStats.map((p) => {
                const share = stats.totalMemories > 0 ? Math.round((p.memoryCount / stats.totalMemories) * 100) : 0;
                return (
                  <TableRow key={p.slug} className="border-[var(--landing-border)]">
                    <TableCell className="font-mono text-[11px] font-medium text-[#F97316]">
                      <span className="flex items-center gap-1.5"><FolderOpen className="h-3 w-3" />{p.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-[var(--landing-text)] text-right">{p.memoryCount}</TableCell>
                    <TableCell className="font-mono text-[11px] text-[#F97316] text-right">{p.pinnedCount}</TableCell>
                    <TableCell className="font-mono text-[11px] text-[var(--landing-text-tertiary)] text-right">{p.archivedCount}</TableCell>
                    <TableCell className="font-mono text-[11px] text-blue-400 text-right">{p.sessionCount}</TableCell>
                    <TableCell className="font-mono text-[11px] text-emerald-400 text-right">{p.activityCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 rounded-full bg-[var(--landing-surface-2)] w-16 overflow-hidden">
                          <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${share}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{share}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
