import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Members" };
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projectMembers,
  projects,
  users,
} from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
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
import { MemberRowActions } from "@/components/dashboard/members/member-row-actions";
import { Shield, ShieldAlert, Lock } from "lucide-react";

const roleBadgeStyles: Record<string, string> = {
  owner:
    "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20",
  admin:
    "bg-blue-500/10 text-blue-500 border-blue-500/20",
  member:
    "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)] border-[var(--landing-border)]",
};

export default async function MembersPage({
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

  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember) redirect("/");

  const isManager =
    currentMember.role === "owner" || currentMember.role === "admin";

  // Show access denied for regular members
  if (!isManager) {
    return (
      <div>
        <PageHeader badge="Team" title="Members" />
        <div className="dash-card flex flex-col items-center justify-center py-16 text-center">
          <Lock className="mb-4 h-10 w-10 text-[var(--landing-text-tertiary)]" />
          <h2 className="mb-2 font-mono text-base font-semibold text-[var(--landing-text)]">
            You don&apos;t have permission to view this page.
          </h2>
          <p className="text-sm text-[var(--landing-text-tertiary)]">
            Contact your organization owner or admin.
          </p>
        </div>
      </div>
    );
  }

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  // Fetch all org projects for assignment UI
  const orgProjects = await db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.orgId, org.id));

  const memberUsers = await Promise.all(
    members.map(async (m) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);

      const assignments = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, m.userId));

      return {
        ...m,
        user: user ?? null,
        projectIds: assignments.map((a) => a.projectId),
      };
    }),
  );

  // Serialize dates for client components
  const serializedMembers = memberUsers.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    user: m.user
      ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
        }
      : null,
    projectIds: m.projectIds,
  }));

  const serializedProjects = orgProjects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
  }));

  return (
    <div>
      <PageHeader
        badge="Team"
        title="Members"
        description={`${members.length} / ${org.memberLimit} members`}
      />

      <div className="dash-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Member
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Email
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Role
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Projects
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Joined
              </TableHead>
              <TableHead className="w-12" />
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

              const projectCount = member.projectIds.length;
              const isOwnerOrAdmin =
                member.role === "owner" || member.role === "admin";

              return (
                <TableRow
                  key={member.id}
                  className="border-[var(--landing-border)]"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-[var(--landing-border)]">
                        {member.user?.avatarUrl && (
                          <AvatarImage
                            src={member.user.avatarUrl}
                            alt={member.user.name}
                          />
                        )}
                        <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-xs text-[var(--landing-text-secondary)]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono text-sm font-medium text-[var(--landing-text)]">
                        {member.user?.name ?? "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--landing-text-secondary)]">
                    {member.user?.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
                        roleBadgeStyles[member.role] ?? roleBadgeStyles.member
                      }`}
                    >
                      {member.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    {isOwnerOrAdmin ? (
                      <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                        All projects
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-[var(--landing-text-secondary)]">
                        {projectCount}{" "}
                        {projectCount === 1 ? "project" : "projects"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {member.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <MemberRowActions
                      member={serializedMembers.find(
                        (sm) => sm.id === member.id,
                      )!}
                      currentUserId={session.user.id}
                      orgSlug={orgSlug}
                      projects={serializedProjects}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
