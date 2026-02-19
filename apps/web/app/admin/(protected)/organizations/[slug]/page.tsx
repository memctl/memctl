import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  projects,
  memories,
  organizationMembers,
} from "@memctl/db/schema";
import { eq, count } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { StatCard } from "@/components/dashboard/shared/stat-card";
import { SectionLabel } from "@/components/dashboard/shared/section-label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  FolderOpen,
  Users as UsersIcon,
  Brain,
  CreditCard,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) notFound();

  const currentPlan = PLANS[org.planId as PlanId] ?? PLANS.free;

  // Get owner
  const [owner] = await db
    .select()
    .from(users)
    .where(eq(users.id, org.ownerId))
    .limit(1);

  // Get projects
  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  // Get members with user data
  const memberList = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const memberUsers = await Promise.all(
    memberList.map(async (m) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);
      return { ...m, user };
    }),
  );

  // Count memories
  let totalMemories = 0;
  for (const project of projectList) {
    const [result] = await db
      .select({ value: count() })
      .from(memories)
      .where(eq(memories.projectId, project.id));
    totalMemories += result?.value ?? 0;
  }

  return (
    <div>
      <PageHeader
        badge="Organization"
        title={org.name}
        description={`Slug: ${org.slug} · Owner: ${owner?.name ?? "Unknown"}`}
      />

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Projects"
          value={`${projectList.length} / ${currentPlan.projectLimit === Infinity ? "∞" : currentPlan.projectLimit}`}
        />
        <StatCard
          icon={UsersIcon}
          label="Members"
          value={`${memberList.length} / ${currentPlan.memberLimit === Infinity ? "∞" : currentPlan.memberLimit}`}
        />
        <StatCard
          icon={Brain}
          label="Total Memories"
          value={totalMemories.toLocaleString()}
        />
        <StatCard
          icon={CreditCard}
          label="Plan"
          value={currentPlan.name}
          trend={currentPlan.price === -1 ? "Custom" : `$${currentPlan.price}/mo`}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Members */}
        <div>
          <SectionLabel>Members</SectionLabel>
          <div className="dash-card mt-3 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Member
                  </TableHead>
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Role
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberUsers.map((member) => {
                  const initials = member.user?.name
                    ? member.user.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "?";
                  return (
                    <TableRow
                      key={member.id}
                      className="border-[var(--landing-border)]"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7 border border-[var(--landing-border)]">
                            {member.user?.avatarUrl && (
                              <AvatarImage
                                src={member.user.avatarUrl}
                                alt={member.user.name}
                              />
                            )}
                            <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-[10px]">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-[var(--landing-text)]">
                              {member.user?.name ?? "Unknown"}
                            </p>
                            <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                              {member.user?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs capitalize text-[var(--landing-text-secondary)]">
                        {member.role}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Projects */}
        <div>
          <SectionLabel>Projects</SectionLabel>
          <div className="dash-card mt-3 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Project
                  </TableHead>
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectList.length === 0 ? (
                  <TableRow className="border-[var(--landing-border)]">
                    <TableCell
                      colSpan={2}
                      className="py-8 text-center font-mono text-sm text-[var(--landing-text-tertiary)]"
                    >
                      No projects
                    </TableCell>
                  </TableRow>
                ) : (
                  projectList.map((project) => (
                    <TableRow
                      key={project.id}
                      className="border-[var(--landing-border)]"
                    >
                      <TableCell>
                        <p className="text-sm font-medium text-[var(--landing-text)]">
                          {project.name}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                          {project.slug}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                        {project.createdAt.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
