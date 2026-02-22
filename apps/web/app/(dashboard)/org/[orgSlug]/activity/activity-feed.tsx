"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, Zap, GitBranch, SquareTerminal, ChevronDown, ChevronRight,
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

function safeParseArray(s: string | null): string[] {
  if (!s) return [];
  try { const parsed = JSON.parse(s); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export function ActivityFeed({ activities, sessions, stats }: ActivityFeedProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const filteredActivities = useMemo(() => {
    let result = activities;
    if (actionFilter) {
      result = result.filter((a) => a.action === actionFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.action.toLowerCase().includes(q) ||
          (a.memoryKey && a.memoryKey.toLowerCase().includes(q)) ||
          (a.toolName && a.toolName.toLowerCase().includes(q)) ||
          a.projectName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [activities, search, actionFilter]);

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

  return (
    <div>
      {/* Compact stats bar */}
      <div className="dash-card mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2.5 py-1.5">
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
      <div className="mb-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search actions, sessions, keys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-xs"
          />
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
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
          {actionTypes.map((action) => (
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {/* Activity panel (left ~60%) */}
        <div className="md:col-span-3">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-3 py-1.5">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">Activity</span>
              <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{filteredActivities.length}</span>
            </div>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredActivities.length === 0 ? (
                <div className="py-8 text-center">
                  <Zap className="mx-auto mb-2 h-5 w-5 text-[var(--landing-text-tertiary)]" />
                  <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">No activity found</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--landing-border)]">
                  {filteredActivities.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--landing-surface-2)]/50 transition-colors">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${ACTION_DOT_BG[a.action] ?? "bg-[var(--landing-text-tertiary)]"}`} />
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sessions panel (right ~40%) */}
        <div className="md:col-span-2">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-3 py-1.5">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">Sessions</span>
              <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{filteredSessions.length}</span>
            </div>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredSessions.length === 0 ? (
                <div className="py-8 text-center">
                  <SquareTerminal className="mx-auto mb-2 h-5 w-5 text-[var(--landing-text-tertiary)]" />
                  <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">No sessions found</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--landing-border)]">
                  {filteredSessions.map((s) => {
                    const keysWritten = safeParseArray(s.keysWritten);
                    const keysRead = safeParseArray(s.keysRead);
                    const toolsUsed = safeParseArray(s.toolsUsed);
                    const isExpanded = expandedSession === s.id;

                    return (
                      <div key={s.id}>
                        <button
                          onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                          className="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-[var(--landing-surface-2)]/50 transition-colors"
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

                        {/* Inline expanded detail */}
                        {isExpanded && (
                          <div className="border-t border-[var(--landing-border)] bg-[var(--landing-surface-2)]/30 px-3 py-2 space-y-2">
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
    </div>
  );
}
