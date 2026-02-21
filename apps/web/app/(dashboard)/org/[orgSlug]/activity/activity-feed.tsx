"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Zap, GitBranch, Clock, SquareTerminal, Brain,
  ArrowRight, ChevronDown, FileText, Eye,
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

function getActionColor(action: string): string {
  switch (action) {
    case "memory_write": return "text-emerald-400";
    case "memory_read": return "text-blue-400";
    case "memory_delete": return "text-red-400";
    case "tool_call": return "text-amber-400";
    default: return "text-[var(--landing-text-tertiary)]";
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case "memory_write": return <Brain className="h-3 w-3 text-emerald-400" />;
    case "memory_read": return <Eye className="h-3 w-3 text-blue-400" />;
    case "memory_delete": return <Brain className="h-3 w-3 text-red-400" />;
    case "tool_call": return <SquareTerminal className="h-3 w-3 text-amber-400" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function safeParseArray(s: string | null): string[] {
  if (!s) return [];
  try { const parsed = JSON.parse(s); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export function ActivityFeed({ activities, sessions, stats }: ActivityFeedProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("feed");
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);

  const filteredActivities = useMemo(() => {
    if (!search) return activities;
    const q = search.toLowerCase();
    return activities.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        (a.memoryKey && a.memoryKey.toLowerCase().includes(q)) ||
        (a.toolName && a.toolName.toLowerCase().includes(q)) ||
        a.projectName.toLowerCase().includes(q),
    );
  }, [activities, search]);

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

  return (
    <TooltipProvider delayDuration={200}>
      <div>
        {/* Stats row */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="dash-card p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Total Actions</div>
            <div className="mt-1 font-mono text-xl font-bold text-[var(--landing-text)]">{stats.totalActions}</div>
          </div>
          <div className="dash-card p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Active Sessions</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-400">{stats.activeSessions}</div>
          </div>
          <div className="dash-card p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Total Sessions</div>
            <div className="mt-1 font-mono text-xl font-bold text-[var(--landing-text)]">{stats.totalSessions}</div>
          </div>
          <div className="dash-card p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Action Types</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(stats.actionBreakdown).slice(0, 4).map(([action, count]) => (
                <span key={action} className={`font-mono text-[10px] ${getActionColor(action)}`}>
                  {action.replace("memory_", "").replace("tool_", "")}:{count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="mb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
            <Input
              placeholder="Search actions, sessions, keys…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-xs"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-2 h-7 bg-[var(--landing-surface)]">
            <TabsTrigger value="feed" className="h-6 text-[10px] px-3">
              Activity Feed ({filteredActivities.length})
            </TabsTrigger>
            <TabsTrigger value="sessions" className="h-6 text-[10px] px-3">
              Sessions ({filteredSessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-0">
            <div className="dash-card overflow-hidden">
              {filteredActivities.length === 0 ? (
                <div className="py-8 text-center">
                  <Zap className="mx-auto mb-2 h-6 w-6 text-[var(--landing-text-tertiary)]" />
                  <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">No activity logged yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--landing-border)]">
                  {filteredActivities.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-3 py-2 hover:bg-[var(--landing-surface-2)]/50 transition-colors">
                      <div className="mt-0.5 shrink-0">{getActionIcon(a.action)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[11px] font-medium ${getActionColor(a.action)}`}>{a.action}</span>
                          {a.toolName && <Badge variant="outline" className="border-[var(--landing-border)] text-[9px] h-4 px-1">{a.toolName}</Badge>}
                          <Badge variant="outline" className="border-[var(--landing-border)] text-[9px] h-4 px-1 text-[var(--landing-text-tertiary)]">{a.projectName}</Badge>
                        </div>
                        {a.memoryKey && (
                          <p className="mt-0.5 font-mono text-[11px] text-[#F97316] truncate">{a.memoryKey}</p>
                        )}
                        {a.details && (
                          <p className="mt-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)] truncate">
                            {(() => { try { const d = JSON.parse(a.details); return Object.entries(d).map(([k, v]) => `${k}=${v}`).join(" "); } catch { return a.details; } })()}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--landing-text-tertiary)]">{relativeTime(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="mt-0">
            <div className="dash-card overflow-hidden">
              {filteredSessions.length === 0 ? (
                <div className="py-8 text-center">
                  <SquareTerminal className="mx-auto mb-2 h-6 w-6 text-[var(--landing-text-tertiary)]" />
                  <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">No sessions recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Session</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Project</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Branch</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Status</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Keys</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Started</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((s) => {
                      const keysWritten = safeParseArray(s.keysWritten);
                      const keysRead = safeParseArray(s.keysRead);
                      return (
                        <TableRow key={s.id} className="border-[var(--landing-border)]">
                          <TableCell className="font-mono text-[11px] text-[#F97316] max-w-[140px] truncate">{s.sessionId}</TableCell>
                          <TableCell><Badge variant="outline" className="border-[var(--landing-border)] text-[9px]">{s.projectName}</Badge></TableCell>
                          <TableCell className="font-mono text-[11px] text-[var(--landing-text-secondary)]">
                            {s.branch && <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{s.branch}</span>}
                          </TableCell>
                          <TableCell>
                            {s.endedAt ? (
                              <span className="inline-flex items-center gap-1 rounded bg-[var(--landing-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                                <Clock className="h-2.5 w-2.5" /> ended
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> active
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                            {keysRead.length > 0 && <span className="text-blue-400">R:{keysRead.length}</span>}
                            {keysWritten.length > 0 && <span className="ml-1 text-emerald-400">W:{keysWritten.length}</span>}
                          </TableCell>
                          <TableCell className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{relativeTime(s.startedAt)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSession(s)} className="h-6 w-6 p-0">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Session Detail Dialog */}
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-lg bg-[var(--landing-surface)]">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm text-[#F97316]">{selectedSession?.sessionId}</DialogTitle>
            </DialogHeader>
            {selectedSession && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-[var(--landing-surface-2)] p-2">
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase">Project</div>
                    <div className="font-mono text-xs text-[var(--landing-text)]">{selectedSession.projectName}</div>
                  </div>
                  <div className="rounded bg-[var(--landing-surface-2)] p-2">
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase">Branch</div>
                    <div className="font-mono text-xs text-[var(--landing-text)]">{selectedSession.branch || "—"}</div>
                  </div>
                  <div className="rounded bg-[var(--landing-surface-2)] p-2">
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase">Started</div>
                    <div className="font-mono text-xs text-[var(--landing-text)]">{relativeTime(selectedSession.startedAt)}</div>
                  </div>
                  <div className="rounded bg-[var(--landing-surface-2)] p-2">
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase">Status</div>
                    <div className="font-mono text-xs">{selectedSession.endedAt ? <span className="text-[var(--landing-text-tertiary)]">Ended {relativeTime(selectedSession.endedAt)}</span> : <span className="text-emerald-400">Active</span>}</div>
                  </div>
                </div>
                {selectedSession.summary && (
                  <div>
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase mb-1">Summary</div>
                    <div className="rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">{selectedSession.summary}</div>
                  </div>
                )}
                {safeParseArray(selectedSession.keysWritten).length > 0 && (
                  <div>
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase mb-1">Keys Written</div>
                    <div className="flex flex-wrap gap-1">
                      {safeParseArray(selectedSession.keysWritten).map((k) => (
                        <Badge key={k} variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {safeParseArray(selectedSession.keysRead).length > 0 && (
                  <div>
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase mb-1">Keys Read</div>
                    <div className="flex flex-wrap gap-1">
                      {safeParseArray(selectedSession.keysRead).map((k) => (
                        <Badge key={k} variant="outline" className="border-blue-500/30 text-blue-400 text-[9px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {safeParseArray(selectedSession.toolsUsed).length > 0 && (
                  <div>
                    <div className="font-mono text-[9px] text-[var(--landing-text-tertiary)] uppercase mb-1">Tools Used</div>
                    <div className="flex flex-wrap gap-1">
                      {safeParseArray(selectedSession.toolsUsed).map((t) => (
                        <Badge key={t} variant="outline" className="border-amber-500/30 text-amber-400 text-[9px]">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
