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
} from "@memctl/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { count } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { StatCard } from "@/components/dashboard/shared/stat-card";
import { SectionLabel } from "@/components/dashboard/shared/section-label";
import {
  FolderOpen,
  Brain,
  Key,
  Users,
  Plus,
  ArrowRight,
} from "lucide-react";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const { orgSlug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) redirect("/");

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member) redirect("/");

  // Parallel DB queries for stats
  const [projectCount, memberCount, tokenCount, projectList] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.orgId, org.id))
        .then((r) => r[0]?.value ?? 0),
      db
        .select({ value: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, org.id))
        .then((r) => r[0]?.value ?? 0),
      db
        .select({ value: count() })
        .from(apiTokens)
        .where(
          and(
            eq(apiTokens.orgId, org.id),
            isNull(apiTokens.revokedAt),
          ),
        )
        .then((r) => r[0]?.value ?? 0),
      db
        .select()
        .from(projects)
        .where(eq(projects.orgId, org.id)),
    ]);

  // Count total memories across all projects
  let totalMemories = 0;
  const recentMemories: {
    key: string;
    content: string;
    updatedAt: Date | null;
    projectName: string;
  }[] = [];

  if (projectList.length > 0) {
    for (const project of projectList) {
      const memCount = await db
        .select({ value: count() })
        .from(memories)
        .where(eq(memories.projectId, project.id))
        .then((r) => r[0]?.value ?? 0);
      totalMemories += memCount;
    }

    // Get recent memories across all projects
    for (const project of projectList) {
      const projectMemories = await db
        .select()
        .from(memories)
        .where(eq(memories.projectId, project.id))
        .orderBy(desc(memories.updatedAt))
        .limit(5);

      for (const m of projectMemories) {
        recentMemories.push({
          key: m.key,
          content: m.content,
          updatedAt: m.updatedAt,
          projectName: project.name,
        });
      }
    }

    // Sort and take top 5
    recentMemories.sort((a, b) => {
      const aTime = a.updatedAt?.getTime() ?? 0;
      const bTime = b.updatedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
    recentMemories.splice(5);
  }

  const quickActions = [
    {
      label: "New Project",
      description: "Create a new project",
      icon: FolderOpen,
      href: `/org/${orgSlug}/projects/new`,
    },
    {
      label: "Create Token",
      description: "Generate an API token",
      icon: Key,
      href: `/org/${orgSlug}/tokens`,
    },
    {
      label: "Invite Member",
      description: "Add a team member",
      icon: Users,
      href: `/org/${orgSlug}/members`,
    },
  ];

  return (
    <div>
      <PageHeader badge="Overview" title={org.name} />

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Total Projects"
          value={projectCount}
          trend={`${org.projectLimit - projectCount} remaining`}
        />
        <StatCard
          icon={Brain}
          label="Total Memories"
          value={totalMemories.toLocaleString()}
        />
        <StatCard
          icon={Key}
          label="API Tokens"
          value={tokenCount}
        />
        <StatCard
          icon={Users}
          label="Members"
          value={memberCount}
          trend={`${org.memberLimit - memberCount} remaining`}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <div className="dash-card glass-border relative flex items-center gap-4 p-4 transition-all hover:border-[#F97316]/30">
                <div className="rounded-lg bg-[#F97316]/10 p-2.5">
                  <action.icon className="h-5 w-5 text-[#F97316]" />
                </div>
                <div className="flex-1">
                  <p className="font-mono text-sm font-medium text-[var(--landing-text)]">
                    {action.label}
                  </p>
                  <p className="text-xs text-[var(--landing-text-tertiary)]">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <SectionLabel>Recent Activity</SectionLabel>
        {recentMemories.length === 0 ? (
          <div className="dash-card mt-3 flex flex-col items-center justify-center py-12 text-center">
            <Brain className="mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
            <p className="mb-1 font-mono text-sm font-medium text-[var(--landing-text)]">
              No activity yet
            </p>
            <p className="text-xs text-[var(--landing-text-tertiary)]">
              Memories will appear here once you start using the MCP server.
            </p>
          </div>
        ) : (
          <div className="dash-card mt-3 overflow-hidden">
            {recentMemories.map((memory, i) => (
              <div
                key={`${memory.key}-${i}`}
                className={`flex items-start justify-between p-4 ${
                  i < recentMemories.length - 1
                    ? "border-b border-[var(--landing-border)]"
                    : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-[#F97316]">
                      {memory.key}
                    </span>
                    <span className="rounded bg-[var(--landing-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                      {memory.projectName}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {memory.content.length > 120
                      ? memory.content.slice(0, 120) + "..."
                      : memory.content}
                  </p>
                </div>
                <span className="ml-4 shrink-0 font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                  {memory.updatedAt
                    ? memory.updatedAt.toLocaleDateString()
                    : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
