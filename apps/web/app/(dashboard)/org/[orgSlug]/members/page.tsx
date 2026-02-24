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
import { eq, and, gt, gte, count as drizzleCount } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import {
  formatLimitValue,
  isSelfHosted,
  INVITATIONS_PER_DAY,
} from "@/lib/plans";
import { orgInvitations } from "@memctl/db/schema";
import { isNull } from "drizzle-orm";
import { InviteMemberDialog } from "@/components/dashboard/members/invite-member-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberRowActions } from "@/components/dashboard/members/member-row-actions";
import { Shield, Lock, Users, Crown, Mail } from "lucide-react";

const roleBadgeStyles: Record<string, string> = {
  owner: "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
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

  // Fetch pending non-expired invitations
  const pendingInvites = await db
    .select()
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, org.id),
        isNull(orgInvitations.acceptedAt),
        gt(orgInvitations.expiresAt, new Date()),
      ),
    );

  const serializedInvitations = pendingInvites.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));

  // Count invitations sent in the last 24 hours for rate limit display
  const selfHosted = isSelfHosted();
  let dailyUsed = 0;
  if (!selfHosted) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [dailyCount] = await db
      .select({ value: drizzleCount() })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.orgId, org.id),
          gte(orgInvitations.createdAt, oneDayAgo),
        ),
      );
    dailyUsed = dailyCount?.value ?? 0;
  }

  const ownerCount = members.filter((m) => m.role === "owner").length;
  const adminCount = members.filter((m) => m.role === "admin").length;
  const memberOnlyCount = members.filter((m) => m.role === "member").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          badge="Team"
          title="Members"
          description={`${members.length} / ${formatLimitValue(org.memberLimit)} members`}
        />
        <InviteMemberDialog
          orgSlug={orgSlug}
          pendingInvitations={serializedInvitations}
          dailyUsed={dailyUsed}
          dailyLimit={selfHosted ? null : INVITATIONS_PER_DAY}
        />
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          {
            icon: Users,
            label: "Total",
            value: members.length,
            sub: `of ${formatLimitValue(org.memberLimit)}`,
            color: "text-[var(--landing-text)]",
          },
          {
            icon: Crown,
            label: "Owners",
            value: ownerCount,
            sub: null,
            color: "text-[#F97316]",
          },
          {
            icon: Shield,
            label: "Admins",
            value: adminCount,
            sub: null,
            color: "text-blue-400",
          },
          {
            icon: Mail,
            label: "Pending",
            value: pendingInvites.length,
            sub: pendingInvites.length > 0 ? "invitations" : null,
            color: "text-emerald-400",
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div
            key={label}
            className="dash-card glass-border relative overflow-hidden p-3"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/20 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] tracking-widest text-[var(--landing-text-tertiary)] uppercase">
                  {label}
                </p>
                <p className={`mt-1 font-mono text-lg font-bold ${color}`}>
                  {value}
                </p>
                {sub && (
                  <p className="font-mono text-[10px] text-[#F97316]">{sub}</p>
                )}
              </div>
              <div className="rounded-lg bg-[#F97316]/10 p-2 shadow-[0_0_8px_rgba(249,115,22,0.06)]">
                <Icon className="h-4 w-4 text-[#F97316]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                  Member
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase sm:table-cell">
                  Email
                </TableHead>
                <TableHead className="font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                  Role
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase md:table-cell">
                  Projects
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase lg:table-cell">
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
                    <TableCell className="hidden font-mono text-xs text-[var(--landing-text-secondary)] sm:table-cell">
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
                    <TableCell className="hidden md:table-cell">
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
                    <TableCell className="hidden font-mono text-xs text-[var(--landing-text-tertiary)] lg:table-cell">
                      {member.createdAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <MemberRowActions
                        member={
                          serializedMembers.find((sm) => sm.id === member.id)!
                        }
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

      {/* Role distribution */}
      {members.length > 1 && (
        <div className="dash-card mt-4 p-3">
          <p className="mb-2 font-mono text-[10px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
            Role distribution
          </p>
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--landing-surface-2)]">
            {ownerCount > 0 && (
              <div
                className="h-full bg-[#F97316]"
                style={{ width: `${(ownerCount / members.length) * 100}%` }}
                title={`${ownerCount} owner${ownerCount > 1 ? "s" : ""}`}
              />
            )}
            {adminCount > 0 && (
              <div
                className="h-full bg-blue-400"
                style={{ width: `${(adminCount / members.length) * 100}%` }}
                title={`${adminCount} admin${adminCount > 1 ? "s" : ""}`}
              />
            )}
            {memberOnlyCount > 0 && (
              <div
                className="h-full bg-[var(--landing-text-tertiary)]"
                style={{
                  width: `${(memberOnlyCount / members.length) * 100}%`,
                }}
                title={`${memberOnlyCount} member${memberOnlyCount > 1 ? "s" : ""}`}
              />
            )}
          </div>
          <div className="mt-1.5 flex gap-4">
            {ownerCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-[#F97316]" />
                <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                  Owner ({ownerCount})
                </span>
              </div>
            )}
            {adminCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                  Admin ({adminCount})
                </span>
              </div>
            )}
            {memberOnlyCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-[var(--landing-text-tertiary)]" />
                <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                  Member ({memberOnlyCount})
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
