import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Overview" };
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  memories,
  organizationMembers,
  apiTokens,
  sessionLogs,
  activityLogs,
} from "@memctl/db/schema";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { count } from "drizzle-orm";
import Link from "next/link";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { formatLimitValue, isUnlimited } from "@/lib/plans";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { Progress } from "@/components/ui/progress";
import {
  FolderOpen,
  Brain,
  Key,
  Users,
  ArrowRight,
  Pin,
  Archive,
  Zap,
  GitBranch,
  Clock,
  Activity,
  HeartPulse,
  Star,
  Tag,
} from "lucide-react";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { orgSlug } = await params;

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) redirect("/");

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, org.id), eq(organizationMembers.userId, session.user.id)))
    .limit(1);
  if (!member) redirect("/");

  const currentPlan = PLANS[org.planId as PlanId] ?? PLANS.free;

  const [projectCount, memberCount, tokenCount, projectList] = await Promise.all([
    db.select({ value: count() }).from(projects).where(eq(projects.orgId, org.id)).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(organizationMembers).where(eq(organizationMembers.orgId, org.id)).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(apiTokens).where(and(eq(apiTokens.orgId, org.id), isNull(apiTokens.revokedAt))).then((r) => r[0]?.value ?? 0),
    db.select().from(projects).where(eq(projects.orgId, org.id)),
  ]);

  let totalMemories = 0;
  let totalPinned = 0;
  let totalArchived = 0;
  let totalSessions = 0;
  let totalActivities = 0;
  const recentMemories: { key: string; content: string; priority: number | null; tags: string | null; updatedAt: Date | null; projectName: string }[] = [];
  const recentSessions: { sessionId: string; branch: string | null; summary: string | null; endedAt: Date | null; startedAt: Date | null; projectName: string }[] = [];
  const memoryByProject: { name: string; slug: string; count: number; pinned: number }[] = [];

  for (const project of projectList) {
    const [memCount] = await db.select({ value: count() }).from(memories).where(eq(memories.projectId, project.id));
    const mc = memCount?.value ?? 0;
    totalMemories += mc;

    const [pinCount] = await db.select({ value: count() }).from(memories).where(and(eq(memories.projectId, project.id), isNotNull(memories.pinnedAt)));
    totalPinned += pinCount?.value ?? 0;

    const [archCount] = await db.select({ value: count() }).from(memories).where(and(eq(memories.projectId, project.id), isNotNull(memories.archivedAt)));
    totalArchived += archCount?.value ?? 0;

    const [sessCount] = await db.select({ value: count() }).from(sessionLogs).where(eq(sessionLogs.projectId, project.id));
    totalSessions += sessCount?.value ?? 0;

    const [actCount] = await db.select({ value: count() }).from(activityLogs).where(eq(activityLogs.projectId, project.id));
    totalActivities += actCount?.value ?? 0;

    memoryByProject.push({ name: project.name, slug: project.slug, count: mc, pinned: pinCount?.value ?? 0 });

    const projectMemories = await db.select().from(memories).where(eq(memories.projectId, project.id)).orderBy(desc(memories.updatedAt)).limit(5);
    for (const m of projectMemories) {
      recentMemories.push({ key: m.key, content: m.content, priority: m.priority, tags: m.tags, updatedAt: m.updatedAt, projectName: project.name });
    }

    const projectSessions = await db.select().from(sessionLogs).where(eq(sessionLogs.projectId, project.id)).orderBy(desc(sessionLogs.startedAt)).limit(3);
    for (const s of projectSessions) {
      recentSessions.push({ sessionId: s.sessionId, branch: s.branch, summary: s.summary, endedAt: s.endedAt, startedAt: s.startedAt, projectName: project.name });
    }
  }

  recentMemories.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
  recentMemories.splice(10);

  recentSessions.sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));
  recentSessions.splice(5);

  const memoryLimit = currentPlan.memoryLimitOrg;
  const usagePercent = memoryLimit === Infinity ? 0 : Math.round((totalMemories / memoryLimit) * 100);

  function relativeTime(d: Date | null): string {
    if (!d) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  function parseTags(s: string | null): string[] {
    if (!s) return [];
    try { const p = JSON.parse(s); return Array.isArray(p) ? p : []; } catch { return []; }
  }

  const quickLinks = [
    { label: "New Project", icon: FolderOpen, href: `/org/${orgSlug}/projects/new` },
    { label: "API Tokens", icon: Key, href: `/org/${orgSlug}/tokens` },
    { label: "Members", icon: Users, href: `/org/${orgSlug}/members` },
    { label: "Activity", icon: Activity, href: `/org/${orgSlug}/activity` },
    { label: "Health", icon: HeartPulse, href: `/org/${orgSlug}/health` },
  ];

  return (
    <div>
      <PageHeader title={org.name} description={`${currentPlan.name} plan`} />

      {/* Stats grid - 6 columns, dense */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          { icon: FolderOpen, label: "Projects", value: projectCount, sub: isUnlimited(org.projectLimit) ? "unlimited" : `${org.projectLimit - projectCount} left`, color: "text-[var(--landing-text)]" },
          { icon: Brain, label: "Memories", value: totalMemories, sub: `${usagePercent}% used`, color: "text-[var(--landing-text)]" },
          { icon: Pin, label: "Pinned", value: totalPinned, sub: null, color: "text-[#F97316]" },
          { icon: Archive, label: "Archived", value: totalArchived, sub: null, color: "text-[var(--landing-text-tertiary)]" },
          { icon: Zap, label: "Sessions", value: totalSessions, sub: null, color: "text-blue-400" },
          { icon: Activity, label: "Actions", value: totalActivities, sub: null, color: "text-emerald-400" },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="dash-card glass-border relative overflow-hidden p-3">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/20 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">{label}</p>
                <p className={`mt-1 font-mono text-lg font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
                {sub && <p className="font-mono text-[10px] text-[#F97316]">{sub}</p>}
              </div>
              <div className="rounded-lg bg-[#F97316]/10 p-2 shadow-[0_0_8px_rgba(249,115,22,0.06)]">
                <Icon className="h-4 w-4 text-[#F97316]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Capacity bar */}
      {memoryLimit !== Infinity && (
        <div className="mb-4 dash-card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Memory Capacity</span>
            <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{totalMemories.toLocaleString()} / {memoryLimit.toLocaleString()}</span>
          </div>
          <Progress
            value={usagePercent}
            className={`h-2 bg-[var(--landing-surface-2)] ${usagePercent >= 90 ? "[&>div]:bg-red-500" : usagePercent >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-[#F97316]"}`}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: Recent memories + sessions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent Memories */}
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
              <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">Recent Memories</span>
              <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{recentMemories.length} latest</span>
            </div>
            {recentMemories.length === 0 ? (
              <div className="py-6 text-center">
                <Brain className="mx-auto mb-2 h-5 w-5 text-[var(--landing-text-tertiary)]" />
                <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">No memories yet. Use the MCP server to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--landing-border)]">
                {recentMemories.map((m, i) => (
                  <div key={`${m.key}-${i}`} className="flex items-start gap-3 px-3 py-2 hover:bg-[var(--landing-surface-2)]/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-medium text-[#F97316] truncate">{m.key}</span>
                        <span className="shrink-0 rounded bg-[var(--landing-surface-2)] px-1 py-0.5 font-mono text-[9px] text-[var(--landing-text-tertiary)]">{m.projectName}</span>
                        {(m.priority ?? 0) > 0 && (
                          <span className="shrink-0 flex items-center gap-0.5 font-mono text-[9px] text-[#F97316]"><Star className="h-2.5 w-2.5" />{m.priority}</span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)] line-clamp-1">{m.content}</p>
                      {parseTags(m.tags).length > 0 && (
                        <div className="mt-0.5 flex gap-0.5">
                          {parseTags(m.tags).slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded bg-[var(--landing-surface-2)] px-1 py-0.5 font-mono text-[8px] text-[var(--landing-text-tertiary)]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-[var(--landing-text-tertiary)]">{relativeTime(m.updatedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
              <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">Recent Sessions</span>
              <Link href={`/org/${orgSlug}/activity`} className="font-mono text-[10px] text-[#F97316] hover:underline">View all</Link>
            </div>
            {recentSessions.length === 0 ? (
              <div className="py-6 text-center">
                <Zap className="mx-auto mb-2 h-5 w-5 text-[var(--landing-text-tertiary)]" />
                <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">No sessions recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--landing-border)]">
                {recentSessions.map((s, i) => (
                  <div key={`${s.sessionId}-${i}`} className="flex items-start gap-3 px-3 py-2">
                    <div className="mt-0.5 shrink-0">
                      {s.endedAt ? (
                        <Clock className="h-3 w-3 text-[var(--landing-text-tertiary)]" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[var(--landing-text)] truncate">{s.sessionId}</span>
                        <span className="shrink-0 rounded bg-[var(--landing-surface-2)] px-1 py-0.5 font-mono text-[9px] text-[var(--landing-text-tertiary)]">{s.projectName}</span>
                        {s.branch && <span className="shrink-0 flex items-center gap-0.5 font-mono text-[9px] text-blue-400"><GitBranch className="h-2.5 w-2.5" />{s.branch}</span>}
                      </div>
                      {s.summary && <p className="mt-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)] line-clamp-1">{s.summary}</p>}
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-[var(--landing-text-tertiary)]">{relativeTime(s.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Quick links + project breakdown */}
        <div className="space-y-4">
          {/* Quick Links */}
          <div className="dash-card overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
              <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">Quick Links</span>
            </div>
            <div className="divide-y divide-[var(--landing-border)]">
              {quickLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  <div className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--landing-surface-2)]/50 transition-colors">
                    <link.icon className="h-3.5 w-3.5 text-[#F97316]" />
                    <span className="flex-1 font-mono text-[11px] text-[var(--landing-text-secondary)]">{link.label}</span>
                    <ArrowRight className="h-3 w-3 text-[var(--landing-text-tertiary)]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Projects breakdown */}
          <div className="dash-card overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
              <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">Projects</span>
            </div>
            {memoryByProject.length === 0 ? (
              <div className="py-4 text-center">
                <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">No projects</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--landing-border)]">
                {memoryByProject.map((p) => {
                  const share = totalMemories > 0 ? Math.round((p.count / totalMemories) * 100) : 0;
                  return (
                    <Link key={p.slug} href={`/org/${orgSlug}/projects/${p.slug}`}>
                      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--landing-surface-2)]/50 transition-colors">
                        <FolderOpen className="h-3 w-3 text-[#F97316] shrink-0" />
                        <span className="flex-1 font-mono text-[11px] text-[var(--landing-text-secondary)] truncate">{p.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-[var(--landing-text)]">{p.count}</span>
                          {p.pinned > 0 && (
                            <span className="flex items-center gap-0.5 font-mono text-[9px] text-[#F97316]"><Pin className="h-2.5 w-2.5" />{p.pinned}</span>
                          )}
                          <div className="h-1.5 w-10 rounded-full bg-[var(--landing-surface-2)] overflow-hidden">
                            <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${share}%` }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Plan info */}
          <div className="dash-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Plan</span>
              <span className="rounded bg-[#F97316]/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#F97316]">{currentPlan.name}</span>
            </div>
            <div className="space-y-1.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              <div className="flex justify-between"><span>Projects</span><span className="text-[var(--landing-text)]">{projectCount}/{formatLimitValue(org.projectLimit)}</span></div>
              <div className="flex justify-between"><span>Members</span><span className="text-[var(--landing-text)]">{memberCount}/{formatLimitValue(org.memberLimit)}</span></div>
              <div className="flex justify-between"><span>Tokens</span><span className="text-[var(--landing-text)]">{tokenCount}</span></div>
              <div className="flex justify-between"><span>Memories</span><span className="text-[var(--landing-text)]">{totalMemories}/{memoryLimit === Infinity ? "∞" : memoryLimit}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
