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
import { getEffectivePlanId } from "@/lib/plans";
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
import { OrgActionsPanel } from "@/components/admin/org-actions-panel";
import { OrgActionHistory } from "@/components/admin/org-action-history";

export const dynamic = "force-dynamic";

const roleBadgeStyles: Record<string, string> = {
  owner: "bg-[#F97316]/10 text-[#F97316]",
  admin: "bg-blue-500/10 text-blue-500",
  member: "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)]",
};

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

  const effectivePlanId = getEffectivePlanId(org);
  const currentPlan = PLANS[effectivePlanId] ?? PLANS.free;

  const [owner] = await db
    .select()
    .from(users)
    .where(eq(users.id, org.ownerId))
    .limit(1);

  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

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

  let totalMemories = 0;
  for (const project of projectList) {
    const [result] = await db
      .select({ value: count() })
      .from(memories)
      .where(eq(memories.projectId, project.id));
    totalMemories += result?.value ?? 0;
  }

  const statusBadgeStyles: Record<string, string> = {
    active: "text-emerald-500",
    suspended: "text-amber-500",
    banned: "text-red-500",
  };

  const stats = [
    {
      label: "Status",
      value: org.status,
      className: statusBadgeStyles[org.status] ?? "",
    },
    {
      label: "Projects",
      value: `${projectList.length} / ${currentPlan.projectLimit === Infinity ? "\u221E" : currentPlan.projectLimit}`,
    },
    {
      label: "Members",
      value: `${memberList.length} / ${currentPlan.memberLimit === Infinity ? "\u221E" : currentPlan.memberLimit}`,
    },
    { label: "Memories", value: totalMemories.toLocaleString() },
    {
      label: "Plan",
      value: currentPlan.name,
      sub:
        org.planOverride
          ? `Override (Stripe: ${org.planId})`
          : currentPlan.price === -1
            ? "Custom"
            : `$${currentPlan.price}/mo`,
    },
  ];

  return (
    <div>
      <PageHeader
        badge="Organization"
        title={org.name}
        description={`Slug: ${org.slug} / Owner: ${owner?.name ?? "Unknown"}`}
      />

      {org.status !== "active" && (
        <div
          className={`mb-4 rounded-md px-4 py-3 font-mono text-[11px] ${
            org.status === "banned"
              ? "bg-red-500/10 text-red-500 border border-red-500/20"
              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
          }`}
        >
          This organization is {org.status}.
          {org.statusReason && ` Reason: ${org.statusReason}`}
        </div>
      )}

      <div className="mb-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="dash-card p-3">
            <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              {s.label}
            </span>
            <span
              className={`block text-lg font-semibold capitalize ${
                "className" in s && s.className
                  ? s.className
                  : "text-[var(--landing-text)]"
              }`}
            >
              {s.value}
            </span>
            {"sub" in s && s.sub && (
              <span className="block font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                {s.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Members */}
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
            <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Members
            </span>
            <span className="rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {memberUsers.length}
            </span>
          </div>
          <div className="overflow-x-auto">
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
                  const badgeStyle =
                    roleBadgeStyles[member.role] ?? roleBadgeStyles.member;
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
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${badgeStyle}`}
                        >
                          {member.role}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Projects */}
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
            <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Projects
            </span>
            <span className="rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {projectList.length}
            </span>
          </div>
          <div className="overflow-x-auto">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <OrgActionsPanel
          org={{
            slug: org.slug,
            status: org.status,
            statusReason: org.statusReason,
            statusChangedAt: org.statusChangedAt?.toISOString() ?? null,
            planId: org.planId,
            planOverride: org.planOverride,
            projectLimit: org.projectLimit,
            memberLimit: org.memberLimit,
            ownerId: org.ownerId,
            adminNotes: org.adminNotes,
          }}
          members={memberUsers.map((m) => ({
            userId: m.userId,
            name: m.user?.name ?? "Unknown",
            email: m.user?.email ?? "",
            role: m.role,
          }))}
        />
        <OrgActionHistory orgSlug={org.slug} />
      </div>
    </div>
  );
}
