"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, Zap, GitBranch, ChevronDown, ChevronRight,
  Shield, UserPlus, UserMinus, FolderPlus, FolderEdit, FolderX,
} from "lucide-react";

interface ActivityItem {
  id: string;
  action: string;
  toolName: string | null;
  memoryKey: string | null;
  details: string | null;
  sessionId: string | null;
  projectName: string;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  actorName: string;
  targetUserName: string | null;
  details: string | null;
  createdAt: string;
}

interface SessionItem {
  id: string;
  sessionId: string;
  branch: string | null;
  summary: string | null;
  keysRead: string | null;
  keysWritten: string | null;
  toolsUsed: string | null;
  startedAt: string;
  endedAt: string | null;
  projectName: string;
}

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

// Audit log styling
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

// Unified timeline item
interface TimelineItem {
  id: string;
  type: "activity" | "audit";
  createdAt: string;
  data: ActivityItem | AuditLogItem;
}

export function ActivityFeed({ activities, auditLogs, sessions, stats }: ActivityFeedProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const hasAuditLogs = (auditLogs?.length ?? 0) > 0;

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

  const filteredTimeline = useMemo(() => {
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

    return result;
  }, [timeline, search, actionFilter]);

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
  const hasData = activities.length > 0 || sessions.length > 0 || hasAuditLogs;

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

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="dash-card flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
        <span className="font-mono text-xs text-[var(--landing-text)]">
          <span className="font-bold">{stats.totalActions}</span>
          <span className="text-[var(--landing-text-tertiary)]"> actions</span>
        </span>
        <span className="text-[var(--landing-text-tertiary)]">·</span>
        <span className="font-mono text-xs text-emerald-400">
          <span className="font-bold">{stats.activeSessions}</span>
          <span className="text-[var(--landing-text-tertiary)]"> active</span>
        </span>
        <span className="text-[var(--landing-text-tertiary)]">·</span>
        <span className="font-mono text-xs text-[var(--landing-text)]">
          <span className="font-bold">{stats.totalSessions}</span>
          <span className="text-[var(--landing-text-tertiary)]"> sessions</span>
        </span>
        {hasAuditLogs && (
          <>
            <span className="text-[var(--landing-text-tertiary)]">·</span>
            <span className="font-mono text-xs text-violet-400">
              <span className="font-bold">{auditLogs!.length}</span>
              <span className="text-[var(--landing-text-tertiary)]"> events</span>
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
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
      </div>

      {/* Search + filter chips */}
      <div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search actions, sessions, keys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-xs"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* Source filter (only if audit logs exist) */}
          {hasAuditLogs && (
            <>
              {(["all", "usage", "dashboard"] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => {
                    setSourceFilter(source);
                    setActionFilter(null);
                  }}
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                    sourceFilter === source
                      ? source === "dashboard"
                        ? "bg-violet-500/15 text-violet-400"
                        : source === "usage"
                          ? "bg-[#F97316]/15 text-[#F97316]"
                          : "bg-[#F97316]/15 text-[#F97316]"
                      : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                  }`}
                >
                  {source === "all" ? "All" : source === "usage" ? "Usage" : "Dashboard"}
                </button>
              ))}
              <span className="mx-1 self-center text-[var(--landing-border)]">|</span>
            </>
          )}
          {/* Action type filters */}
          {!hasAuditLogs && (
            <button
              onClick={() => setActionFilter(null)}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                actionFilter === null
                  ? "bg-[#F97316]/15 text-[#F97316]"
                  : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
              }`}
            >
              All
            </button>
          )}
          {sourceFilter !== "dashboard" && actionTypes.map((action) => (
            <button
              key={action}
              onClick={() => setActionFilter(actionFilter === action ? null : action)}
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
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {/* Activity panel */}
        <div className="md:col-span-3">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-3 py-2">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                {sourceFilter === "dashboard" ? "Dashboard events" : sourceFilter === "usage" ? "Usage activity" : "Activity"}
              </span>
              <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{filteredTimeline.length}</span>
            </div>
            {filteredTimeline.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">No matching activity</p>
              </div>
            ) : (
              <div className="max-h-[32rem] overflow-y-auto divide-y divide-[var(--landing-border)]">
                {filteredTimeline.map((item) => {
                  if (item.type === "activity") {
                    const a = item.data as ActivityItem;
                    return (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--landing-surface-2)]/50 transition-colors">
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

                  // Audit log item
                  const a = item.data as AuditLogItem;
                  const AuditIcon = AUDIT_ICONS[a.action] ?? Shield;
                  const detail = formatAuditDetails(a.action, a.details, a.targetUserName);

                  return (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--landing-surface-2)]/50 transition-colors">
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
              </div>
            )}
          </div>
        </div>

        {/* Sessions panel */}
        <div className="md:col-span-2">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-3 py-2">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">Sessions</span>
              <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{filteredSessions.length}</span>
            </div>
            {filteredSessions.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">No matching sessions</p>
              </div>
            ) : (
              <div className="max-h-[32rem] overflow-y-auto divide-y divide-[var(--landing-border)]">
                {filteredSessions.map((s) => {
                  const keysWritten = safeParseArray(s.keysWritten);
                  const keysRead = safeParseArray(s.keysRead);
                  const toolsUsed = safeParseArray(s.toolsUsed);
                  const isExpanded = expandedSession === s.id;

                  return (
                    <div key={s.id}>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
