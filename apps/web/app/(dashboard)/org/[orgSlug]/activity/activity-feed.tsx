"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ActivitySkeleton } from "@/components/activity/activity-skeleton";
import { useActivityFeed, useSessionFeed } from "@/hooks/use-activity-feed";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type {
  ActivityItem,
  AuditLogItem,
  SessionItem,
  ActivityFilters,
} from "@/lib/activity-types";
import type { DateRange } from "react-day-picker";
import {
  Search, Zap, GitBranch, ChevronDown, ChevronRight,
  Shield, UserPlus, UserMinus, FolderPlus, FolderEdit, FolderX, X,
} from "lucide-react";

export type { ActivityItem, AuditLogItem, SessionItem };

interface ActivityFeedProps {
  activities: ActivityItem[];
  auditLogs?: AuditLogItem[];
  sessions: SessionItem[];
  stats: {
    totalActions: number;
    actionBreakdown: Record<string, number>;
    activeSessions: number;
    totalSessions: number;
  };
  // Smart mode props (when set, enables cursor-based pagination)
  apiPath?: string;
  sessionsApiPath?: string;
  initialCursor?: string | null;
  initialSessionsCursor?: string | null;
}

function relativeTime(d: string | null): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const ACTION_COLORS: Record<string, string> = {
  memory_write: "text-emerald-400",
  memory_read: "text-blue-400",
  memory_delete: "text-red-400",
  tool_call: "text-amber-400",
};

const ACTION_DOT_BG: Record<string, string> = {
  memory_write: "bg-emerald-400",
  memory_read: "bg-blue-400",
  memory_delete: "bg-red-400",
  tool_call: "bg-amber-400",
};

const ACTION_PILL_STYLES: Record<string, string> = {
  memory_write: "bg-emerald-500/15 text-emerald-400",
  memory_read: "bg-blue-500/15 text-blue-400",
  memory_delete: "bg-red-500/15 text-red-400",
  tool_call: "bg-amber-500/15 text-amber-400",
};

const ACTION_LABELS: Record<string, string> = {
  memory_write: "write",
  memory_read: "read",
  memory_delete: "delete",
  tool_call: "tool",
};

const AUDIT_COLORS: Record<string, string> = {
  role_changed: "text-violet-400",
  member_removed: "text-red-400",
  member_assigned: "text-cyan-400",
  member_unassigned: "text-orange-400",
  project_created: "text-emerald-400",
  project_updated: "text-blue-400",
  project_deleted: "text-red-400",
};

const AUDIT_DOT_BG: Record<string, string> = {
  role_changed: "bg-violet-400",
  member_removed: "bg-red-400",
  member_assigned: "bg-cyan-400",
  member_unassigned: "bg-orange-400",
  project_created: "bg-emerald-400",
  project_updated: "bg-blue-400",
  project_deleted: "bg-red-400",
};

const AUDIT_ICONS: Record<string, typeof Shield> = {
  role_changed: Shield,
  member_removed: UserMinus,
  member_assigned: UserPlus,
  member_unassigned: UserMinus,
  project_created: FolderPlus,
  project_updated: FolderEdit,
  project_deleted: FolderX,
};

const AUDIT_LABELS: Record<string, string> = {
  role_changed: "Role changed",
  member_removed: "Member removed",
  member_assigned: "Member assigned",
  member_unassigned: "Member unassigned",
  project_created: "Project created",
  project_updated: "Project updated",
  project_deleted: "Project deleted",
};

function formatAuditDetails(action: string, details: string | null, targetUserName: string | null): string {
  const parsed = details ? (() => { try { return JSON.parse(details); } catch { return null; } })() : null;

  switch (action) {
    case "role_changed":
      if (parsed?.oldRole && parsed?.newRole) {
        return `${targetUserName ?? "User"}: ${parsed.oldRole} → ${parsed.newRole}`;
      }
      return targetUserName ?? "";
    case "member_removed":
      return targetUserName ?? "User";
    case "member_assigned":
    case "member_unassigned":
      return targetUserName ?? "User";
    case "project_created":
      return parsed?.name ?? "";
    case "project_updated":
      if (parsed?.name) return `name: ${parsed.name}`;
      return "";
    case "project_deleted":
      return parsed?.name ?? "";
    default:
      return targetUserName ?? "";
  }
}

type SourceFilter = "all" | "usage" | "dashboard";

function safeParseArray(s: string | null): string[] {
  if (!s) return [];
  try { const parsed = JSON.parse(s); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

interface TimelineItem {
  id: string;
  type: "activity" | "audit";
  createdAt: string;
  data: ActivityItem | AuditLogItem;
}

function PulsingDots() {
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-[#F97316] animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#F97316] animate-pulse [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#F97316] animate-pulse [animation-delay:300ms]" />
    </div>
  );
}

export function ActivityFeed({
  activities: initialActivities,
  auditLogs: initialAuditLogs,
  sessions: initialSessions,
  stats,
  apiPath,
  sessionsApiPath,
  initialCursor,
  initialSessionsCursor,
}: ActivityFeedProps) {
  const isSmartMode = !!apiPath;

  // Always call hooks (rules of hooks), but pass safe defaults when not in smart mode
  const activityFeed = useActivityFeed({
    apiPath: apiPath ?? "",
    initialActivities,
    initialAuditLogs: initialAuditLogs ?? [],
    initialCursor: initialCursor ?? null,
  });

  const sessionFeed = useSessionFeed({
    apiPath: sessionsApiPath ?? "",
    initialSessions,
    initialCursor: initialSessionsCursor ?? null,
  });

  // Determine active data source
  const activities = isSmartMode ? activityFeed.activities : initialActivities;
  const auditLogs = isSmartMode ? activityFeed.auditLogs : (initialAuditLogs ?? []);
  const sessions = isSmartMode && sessionsApiPath ? sessionFeed.sessions : initialSessions;

  // Local state for filtering (legacy mode uses client-side, smart mode uses server-side)
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Debounced search for smart mode
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentFiltersRef = useRef<ActivityFilters>({});

  const applySmartFilters = useCallback(
    (overrides: Partial<ActivityFilters>) => {
      if (!isSmartMode) return;
      const newFilters = { ...currentFiltersRef.current, ...overrides };
      currentFiltersRef.current = newFilters;
      activityFeed.applyFilters(newFilters);
    },
    [isSmartMode, activityFeed],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (isSmartMode) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        applySmartFilters({ search: value || undefined });
      }, 300);
    }
  };

  const handleActionFilterChange = (action: string | null) => {
    setActionFilter(action);
    if (isSmartMode) {
      applySmartFilters({ action: action ?? undefined });
    }
  };

  const handleSourceFilterChange = (source: SourceFilter) => {
    setSourceFilter(source);
    setActionFilter(null);
    if (isSmartMode) {
      applySmartFilters({ source, action: undefined });
    }
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (isSmartMode) {
      applySmartFilters({
        from: range?.from?.toISOString() ?? undefined,
        to: range?.to?.toISOString() ?? undefined,
      });
    }
  };

  const hasFiltersActive = !!search || !!actionFilter || sourceFilter !== "all" || !!dateRange;

  const clearAllFilters = () => {
    setSearch("");
    setActionFilter(null);
    setSourceFilter("all");
    setDateRange(undefined);
    if (isSmartMode) {
      currentFiltersRef.current = {};
      activityFeed.applyFilters({});
    }
  };

  // Infinite scroll for activity panel (smart mode only)
  const { sentinelRef } = useInfiniteScroll({
    hasMore: isSmartMode ? activityFeed.hasMore : false,
    isLoading: activityFeed.isLoading,
    onLoadMore: activityFeed.loadMore,
  });

  const hasAuditLogs = auditLogs.length > 0;

  // Build unified timeline
  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    if (sourceFilter !== "dashboard") {
      for (const a of activities) {
        items.push({ id: a.id, type: "activity", createdAt: a.createdAt, data: a });
      }
    }

    if (sourceFilter !== "usage" && auditLogs) {
      for (const a of auditLogs) {
        items.push({ id: `audit-${a.id}`, type: "audit", createdAt: a.createdAt, data: a });
      }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [activities, auditLogs, sourceFilter]);

  // Client-side filtering (legacy mode only; smart mode filters server-side)
  const filteredTimeline = useMemo(() => {
    if (isSmartMode) return timeline;
    let result = timeline;

    if (actionFilter) {
      result = result.filter((item) => {
        if (item.type === "activity") return (item.data as ActivityItem).action === actionFilter;
        if (item.type === "audit") return (item.data as AuditLogItem).action === actionFilter;
        return false;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((item) => {
        if (item.type === "activity") {
          const a = item.data as ActivityItem;
          return (
            a.action.toLowerCase().includes(q) ||
            (a.memoryKey && a.memoryKey.toLowerCase().includes(q)) ||
            (a.toolName && a.toolName.toLowerCase().includes(q)) ||
            a.projectName.toLowerCase().includes(q)
          );
        }
        if (item.type === "audit") {
          const a = item.data as AuditLogItem;
          return (
            a.action.toLowerCase().includes(q) ||
            a.actorName.toLowerCase().includes(q) ||
            (a.targetUserName && a.targetUserName.toLowerCase().includes(q)) ||
            (AUDIT_LABELS[a.action] ?? a.action).toLowerCase().includes(q)
          );
        }
        return false;
      });
    }

    // Client-side date filtering for legacy mode
    if (dateRange?.from) {
      const fromMs = dateRange.from.getTime();
      const toMs = dateRange.to ? dateRange.to.getTime() + 86400000 : Infinity;
      result = result.filter((item) => {
        const ts = new Date(item.createdAt).getTime();
        return ts >= fromMs && ts < toMs;
      });
    }

    return result;
  }, [timeline, search, actionFilter, isSmartMode, dateRange]);

  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.sessionId.toLowerCase().includes(q) ||
        (s.branch && s.branch.toLowerCase().includes(q)) ||
        (s.summary && s.summary.toLowerCase().includes(q)) ||
        s.projectName.toLowerCase().includes(q),
    );
  }, [sessions, search]);

  const actionTypes = Object.keys(stats.actionBreakdown);
  const hasData = initialActivities.length > 0 || initialSessions.length > 0 || (initialAuditLogs?.length ?? 0) > 0;

  if (!hasData) {
    return (
      <div className="dash-card px-6 py-10 text-center">
        <Zap className="mx-auto mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
        <p className="font-mono text-sm text-[var(--landing-text-secondary)]">No activity yet</p>
        <p className="mt-1 font-mono text-xs text-[var(--landing-text-tertiary)]">
          Actions and sessions will appear here once agents start interacting with your projects.
        </p>
      </div>
    );
  }

  const activeFilterCount = [
    !!search,
    !!actionFilter,
    sourceFilter !== "all",
    !!dateRange,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Unified toolbar */}
      <div className="dash-card overflow-hidden">
        {/* Search row */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--landing-border)]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
            <Input
              placeholder="Search actions, sessions, keys…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-7 pl-8 border-[var(--landing-border)] bg-[var(--landing-surface-2)]/50 font-mono text-xs placeholder:text-[var(--landing-text-tertiary)]/60"
            />
          </div>
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          {hasFiltersActive && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--landing-surface-2)] px-2 py-1 font-mono text-[10px] font-medium text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)] transition-colors"
            >
              <X className="h-2.5 w-2.5" />
              Clear{activeFilterCount > 1 ? ` (${activeFilterCount})` : ""}
            </button>
          )}
        </div>

        {/* Filter chips row */}
        <div className="flex items-center gap-3 px-3 py-1.5">
          {/* Source filter group */}
          {hasAuditLogs && (
            <div className="flex items-center gap-1">
              {(["all", "usage", "dashboard"] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => handleSourceFilterChange(source)}
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                    sourceFilter === source
                      ? source === "dashboard"
                        ? "bg-violet-500/15 text-violet-400"
                        : "bg-[#F97316]/15 text-[#F97316]"
                      : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                  }`}
                >
                  {source === "all" ? "All" : source === "usage" ? "Usage" : "Dashboard"}
                </button>
              ))}
            </div>
          )}

          {/* Separator dot */}
          {hasAuditLogs && sourceFilter !== "dashboard" && actionTypes.length > 0 && (
            <span className="h-3 w-px bg-[var(--landing-border)]" />
          )}

          {/* Action type filter group */}
          {sourceFilter !== "dashboard" && actionTypes.length > 0 && (
            <div className="flex items-center gap-1">
              {!hasAuditLogs && (
                <button
                  onClick={() => handleActionFilterChange(null)}
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                    actionFilter === null
                      ? "bg-[#F97316]/15 text-[#F97316]"
                      : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                  }`}
                >
                  All
                </button>
              )}
              {actionTypes.map((action) => (
                <button
                  key={action}
                  onClick={() => handleActionFilterChange(actionFilter === action ? null : action)}
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                    actionFilter === action
                      ? ACTION_PILL_STYLES[action] ?? "bg-[var(--landing-surface-2)] text-[var(--landing-text)]"
                      : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                  }`}
                >
                  {ACTION_LABELS[action] ?? action}
                </button>
              ))}
            </div>
          )}

          {/* Stats pushed to the right */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              {Object.entries(stats.actionBreakdown).map(([action, count]) => (
                <span
                  key={action}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${ACTION_PILL_STYLES[action] ?? "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)]"}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${ACTION_DOT_BG[action] ?? "bg-[var(--landing-text-tertiary)]"}`} />
                  {ACTION_LABELS[action] ?? action}:{count}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-[var(--landing-text)]">
                <span className="font-bold">{stats.totalActions}</span>
                <span className="text-[var(--landing-text-tertiary)]"> acts</span>
              </span>
              <span className="text-emerald-400">
                <span className="font-bold">{stats.activeSessions}</span>
                <span className="text-[var(--landing-text-tertiary)]"> live</span>
              </span>
              <span className="text-[var(--landing-text)]">
                <span className="font-bold">{stats.totalSessions}</span>
                <span className="text-[var(--landing-text-tertiary)]"> sess</span>
              </span>
              {hasAuditLogs && (
                <span className="text-violet-400">
                  <span className="font-bold">{auditLogs.length}</span>
                  <span className="text-[var(--landing-text-tertiary)]"> evt</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {/* Activity panel */}
        <div className="md:col-span-3">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-3 py-2">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                {sourceFilter === "dashboard" ? "Dashboard events" : sourceFilter === "usage" ? "Usage activity" : "Activity"}
              </span>
              <div className="flex items-center gap-2">
                {hasFiltersActive && (
                  <span className="rounded-full bg-[#F97316]/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#F97316]">filtered</span>
                )}
                <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{filteredTimeline.length}</span>
              </div>
            </div>
            {isSmartMode && activityFeed.isFiltering ? (
              <ActivitySkeleton />
            ) : filteredTimeline.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Search className="mx-auto mb-2 h-5 w-5 text-[var(--landing-text-tertiary)]/50" />
                <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                  {hasFiltersActive ? "No activity matching your filters" : "No activity recorded"}
                </p>
                {hasFiltersActive && (
                  <p className="mt-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]/60">
                    Try adjusting your search or date range
                  </p>
                )}
              </div>
            ) : (
              <div className="max-h-[32rem] overflow-y-auto">
                {filteredTimeline.map((item, idx) => {
                  const isLast = idx === filteredTimeline.length - 1;

                  if (item.type === "activity") {
                    const a = item.data as ActivityItem;
                    return (
                      <div key={item.id} className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--landing-surface-2)]/50 transition-colors${isLast ? "" : " border-b border-[var(--landing-border)]"}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ACTION_DOT_BG[a.action] ?? "bg-[var(--landing-text-tertiary)]"}`} />
                        <span className={`shrink-0 font-mono text-[11px] font-medium ${ACTION_COLORS[a.action] ?? "text-[var(--landing-text-tertiary)]"}`}>
                          {ACTION_LABELS[a.action] ?? a.action}
                        </span>
                        {a.memoryKey && (
                          <span className="min-w-0 truncate font-mono text-[11px] text-[#F97316]">{a.memoryKey}</span>
                        )}
                        {a.toolName && !a.memoryKey && (
                          <span className="min-w-0 truncate font-mono text-[11px] text-amber-400">{a.toolName}</span>
                        )}
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--landing-text-tertiary)]">{a.projectName}</span>
                        <span className="shrink-0 font-mono text-[10px] text-[var(--landing-text-tertiary)]">{relativeTime(a.createdAt)}</span>
                      </div>
                    );
                  }

                  const a = item.data as AuditLogItem;
                  const AuditIcon = AUDIT_ICONS[a.action] ?? Shield;
                  const detail = formatAuditDetails(a.action, a.details, a.targetUserName);

                  return (
                    <div key={item.id} className={`flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--landing-surface-2)]/50 transition-colors${isLast ? "" : " border-b border-[var(--landing-border)]"}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${AUDIT_DOT_BG[a.action] ?? "bg-violet-400"}`} />
                      <AuditIcon className={`h-3 w-3 shrink-0 ${AUDIT_COLORS[a.action] ?? "text-violet-400"}`} />
                      <span className={`shrink-0 font-mono text-[11px] font-medium ${AUDIT_COLORS[a.action] ?? "text-violet-400"}`}>
                        {AUDIT_LABELS[a.action] ?? a.action}
                      </span>
                      {detail && (
                        <span className="min-w-0 truncate font-mono text-[11px] text-[var(--landing-text-secondary)]">
                          {detail}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                        {a.actorName}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--landing-text-tertiary)]">{relativeTime(a.createdAt)}</span>
                    </div>
                  );
                })}

                {/* Infinite scroll sentinel + loading indicator */}
                {isSmartMode && (
                  <>
                    {activityFeed.isLoading && <PulsingDots />}
                    <div ref={sentinelRef} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sessions panel */}
        <div className="md:col-span-2">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-3 py-2">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">Sessions</span>
              <div className="flex items-center gap-2">
                {stats.activeSessions > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-emerald-400">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                    {stats.activeSessions} live
                  </span>
                )}
                <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{filteredSessions.length}</span>
              </div>
            </div>
            {filteredSessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <GitBranch className="mx-auto mb-2 h-5 w-5 text-[var(--landing-text-tertiary)]/50" />
                <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">No sessions found</p>
              </div>
            ) : (
              <div className="max-h-[32rem] overflow-y-auto">
                {filteredSessions.map((s, idx) => {
                  const keysWritten = safeParseArray(s.keysWritten);
                  const keysRead = safeParseArray(s.keysRead);
                  const toolsUsed = safeParseArray(s.toolsUsed);
                  const isExpanded = expandedSession === s.id;
                  const isLastSession = idx === filteredSessions.length - 1;

                  return (
                    <div key={s.id} className={isLastSession ? "" : "border-b border-[var(--landing-border)]"}>
                      <button
                        onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--landing-surface-2)]/50 transition-colors"
                      >
                        <span className="mt-0.5 shrink-0 text-[var(--landing-text-tertiary)]">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-mono text-[11px] font-medium text-[#F97316]">
                              {s.sessionId.length > 12 ? s.sessionId.slice(0, 12) + "…" : s.sessionId}
                            </span>
                            {s.branch && (
                              <span className="flex items-center gap-0.5 font-mono text-[10px] text-[var(--landing-text-secondary)]">
                                <GitBranch className="h-2.5 w-2.5" />
                                {s.branch}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px]">
                            {s.endedAt ? (
                              <span className="text-[var(--landing-text-tertiary)]">ended</span>
                            ) : (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                active
                              </span>
                            )}
                            {keysRead.length > 0 && <span className="text-blue-400">R:{keysRead.length}</span>}
                            {keysWritten.length > 0 && <span className="text-emerald-400">W:{keysWritten.length}</span>}
                            <span className="text-[var(--landing-text-tertiary)]">{relativeTime(s.startedAt)}</span>
                            <span className="text-[var(--landing-text-tertiary)]">{s.projectName}</span>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[var(--landing-border)] bg-[var(--landing-surface-2)]/30 px-4 py-2.5 space-y-2">
                          {s.summary && (
                            <p className="font-mono text-[10px] text-[var(--landing-text-secondary)]">{s.summary}</p>
                          )}
                          {keysWritten.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {keysWritten.map((k) => (
                                <Badge key={k} variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px] h-4 px-1">{k}</Badge>
                              ))}
                            </div>
                          )}
                          {keysRead.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {keysRead.map((k) => (
                                <Badge key={k} variant="outline" className="border-blue-500/30 text-blue-400 text-[9px] h-4 px-1">{k}</Badge>
                              ))}
                            </div>
                          )}
                          {toolsUsed.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {toolsUsed.map((t) => (
                                <Badge key={t} variant="outline" className="border-amber-500/30 text-amber-400 text-[9px] h-4 px-1">{t}</Badge>
                              ))}
                            </div>
                          )}
                          {!s.summary && keysWritten.length === 0 && keysRead.length === 0 && toolsUsed.length === 0 && (
                            <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">No details available</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Sessions load more button */}
                {isSmartMode && sessionsApiPath && sessionFeed.hasMore && (
                  <div className="border-t border-[var(--landing-border)] px-3 py-2.5">
                    <button
                      onClick={sessionFeed.loadMore}
                      disabled={sessionFeed.isLoading}
                      className="w-full rounded-md border border-[var(--landing-border)] bg-[var(--landing-surface-2)]/50 py-1.5 font-mono text-[10px] font-medium text-[var(--landing-text-tertiary)] hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)] transition-all disabled:opacity-50"
                    >
                      {sessionFeed.isLoading ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-[var(--landing-text-tertiary)] animate-pulse" />
                          <span className="h-1 w-1 rounded-full bg-[var(--landing-text-tertiary)] animate-pulse [animation-delay:150ms]" />
                          <span className="h-1 w-1 rounded-full bg-[var(--landing-text-tertiary)] animate-pulse [animation-delay:300ms]" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <ChevronDown className="h-3 w-3" />
                          Load more sessions
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
