"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, Clock, Trash2, BarChart3, HardDrive, Loader2, Database,
} from "lucide-react";

interface HygieneDashboardProps {
  healthBuckets: { critical: number; low: number; medium: number; healthy: number };
  staleMemories: Array<{ key: string; project: string; lastAccessedAt: string | null; priority: number }>;
  expiringMemories: Array<{ key: string; project: string; expiresAt: string }>;
  growth: Array<{ week: string; count: number }>;
  capacity: { used: number; limit: number | null; usagePercent: number };
  orgSlug: string;
  tableSizes?: { versions: number; activityLogs: number; webhookEvents: number; expiredLocks: number };
}

export function HygieneDashboard({
  healthBuckets, staleMemories, expiringMemories, growth, capacity, orgSlug, tableSizes,
}: HygieneDashboardProps) {
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const totalHealth = healthBuckets.critical + healthBuckets.low + healthBuckets.medium + healthBuckets.healthy;
  const maxGrowth = Math.max(...growth.map((g) => g.count), 1);

  async function runCleanup() {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await fetch(`/api/v1/memories/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Slug": orgSlug, "X-Project-Slug": "_all" },
        body: JSON.stringify({
          policies: ["cleanup_expired", "cleanup_session_logs", "auto_archive_unhealthy", "cleanup_old_versions", "cleanup_activity_logs", "cleanup_webhook_events", "cleanup_expired_locks", "purge_archived"],
          healthThreshold: 15,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const total = Object.values(data.results as Record<string, { affected: number }>).reduce((s, r) => s + r.affected, 0);
        setCleanupResult(`Cleanup complete: ${total} memories affected.`);
      } else {
        setCleanupResult("Cleanup failed. Check your permissions.");
      }
    } catch {
      setCleanupResult("Cleanup failed. Network error.");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div>
      {/* Top row: Capacity gauge + Health distribution */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Capacity Gauge */}
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">Capacity</span>
          </div>
          <div className="mb-2 flex items-end justify-between">
            <span className="font-mono text-2xl font-bold text-[var(--landing-text)]">{capacity.used}</span>
            <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
              / {capacity.limit ?? "\u221E"} memories
            </span>
          </div>
          <Progress
            value={capacity.usagePercent}
            className="h-2"
          />
          <span className="mt-1 block font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            {capacity.usagePercent}% used
          </span>
        </div>

        {/* Health Distribution */}
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">Health Distribution</span>
            <span className="ml-auto font-mono text-[10px] text-[var(--landing-text-tertiary)]">{totalHealth} total</span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Healthy (75-100)", count: healthBuckets.healthy, color: "bg-emerald-500" },
              { label: "Medium (50-75)", count: healthBuckets.medium, color: "bg-blue-500" },
              { label: "Low (25-50)", count: healthBuckets.low, color: "bg-amber-500" },
              { label: "Critical (0-25)", count: healthBuckets.critical, color: "bg-red-500" },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-28 font-mono text-[10px] text-[var(--landing-text-tertiary)]">{label}</span>
                <div className="flex-1">
                  <div
                    className={`h-3 rounded-sm ${color}`}
                    style={{ width: `${totalHealth > 0 ? (count / totalHealth) * 100 : 0}%`, minWidth: count > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-[var(--landing-text)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Memory Growth */}
      {growth.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">Memory Growth (by week)</span>
          </div>
          <div className="flex items-end gap-1" style={{ height: "80px" }}>
            {growth.map(({ week, count }) => (
              <div key={week} className="group relative flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t-sm bg-[#F97316]/70 transition-colors group-hover:bg-[#F97316]"
                  style={{ height: `${(count / maxGrowth) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                />
                <span className="mt-1 hidden font-mono text-[8px] text-[var(--landing-text-tertiary)] group-hover:block">
                  {week.slice(5)} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Health */}
      {tableSizes && (
        <div className="mb-4 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">Table Health</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {([
              { label: "Versions", value: tableSizes.versions, warn: 100_000 },
              { label: "Activity Logs", value: tableSizes.activityLogs, warn: 100_000 },
              { label: "Webhook Events", value: tableSizes.webhookEvents, warn: 50_000 },
              { label: "Expired Locks", value: tableSizes.expiredLocks, warn: 10 },
            ] as const).map(({ label, value, warn }) => (
              <div key={label} className="rounded-md border border-[var(--landing-border)] p-3">
                <span className="block font-mono text-[10px] text-[var(--landing-text-tertiary)]">{label}</span>
                <span className={`font-mono text-lg font-bold ${value >= warn ? "text-amber-400" : "text-[var(--landing-text)]"}`}>
                  {value.toLocaleString()}
                </span>
                {value >= warn && (
                  <span className="block font-mono text-[9px] text-amber-400">
                    Above threshold ({warn.toLocaleString()})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stale + Expiring side by side */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Stale Memories */}
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">
              Stale Memories
            </span>
            <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
              {staleMemories.length}
            </Badge>
          </div>
          {staleMemories.length === 0 ? (
            <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">No stale memories found.</p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {staleMemories.slice(0, 15).map((m) => (
                <div key={`${m.project}/${m.key}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-[var(--landing-surface-2)]">
                  <span className="flex-1 truncate font-mono text-[11px] text-[var(--landing-text)]">{m.key}</span>
                  <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">{m.project}</span>
                </div>
              ))}
              {staleMemories.length > 15 && (
                <p className="px-2 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  + {staleMemories.length - 15} more
                </p>
              )}
            </div>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">
              Expiring Soon (7 days)
            </span>
            <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
              {expiringMemories.length}
            </Badge>
          </div>
          {expiringMemories.length === 0 ? (
            <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">No memories expiring soon.</p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {expiringMemories.slice(0, 15).map((m) => (
                <div key={`${m.project}/${m.key}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-[var(--landing-surface-2)]">
                  <span className="flex-1 truncate font-mono text-[11px] text-[var(--landing-text)]">{m.key}</span>
                  <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                    {new Date(m.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Run Cleanup */}
      <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
        <div className="flex items-center gap-3">
          <Trash2 className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
          <div className="flex-1">
            <span className="font-mono text-xs font-medium text-[var(--landing-text)]">Run Cleanup</span>
            <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Removes expired memories, old session logs, old versions, webhook events, expired locks, and purges archived memories.
            </p>
          </div>
          <button
            onClick={runCleanup}
            disabled={cleaning}
            className="flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 font-mono text-xs font-medium text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
          >
            {cleaning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            {cleaning ? "Running..." : "Run Cleanup"}
          </button>
        </div>
        {cleanupResult && (
          <p className="mt-2 font-mono text-xs text-[var(--landing-text-secondary)]">{cleanupResult}</p>
        )}
      </div>
    </div>
  );
}
