import { db } from "@/lib/db";
import {
  organizations,
  users,
  projects,
  organizationMembers,
} from "@memctl/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  const allOrgs = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  const orgsWithDetails = await Promise.all(
    allOrgs.map(async (org) => {
      const [owner] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, org.ownerId))
        .limit(1);

      const [projectCount] = await db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.orgId, org.id));

      const [memberCount] = await db
        .select({ value: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, org.id));

      return {
        ...org,
        ownerName: owner?.name ?? "Unknown",
        projectCount: projectCount?.value ?? 0,
        memberCount: memberCount?.value ?? 0,
      };
    }),
  );

  const planBadgeStyles: Record<string, string> = {
    free: "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)]",
    lite: "bg-blue-500/10 text-blue-500",
    pro: "bg-[#F97316]/10 text-[#F97316]",
    business: "bg-purple-500/10 text-purple-500",
    scale: "bg-emerald-500/10 text-emerald-500",
    enterprise: "bg-amber-500/10 text-amber-500",
  };

  const activeCount = orgsWithDetails.filter((o) => o.status === "active").length;
  const suspendedBanned = orgsWithDetails.filter(
    (o) => o.status === "suspended" || o.status === "banned",
  ).length;
  const proPlus = orgsWithDetails.filter(
    (o) => o.planId !== "free",
  ).length;

  const stats = [
    { label: "Total Orgs", value: allOrgs.length },
    { label: "Active", value: activeCount },
    { label: "Suspended/Banned", value: suspendedBanned },
    { label: "Pro+", value: proPlus },
  ];

  const statusBadgeStyles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500",
    suspended: "bg-amber-500/10 text-amber-500",
    banned: "bg-red-500/10 text-red-500",
  };

  return (
    <div>
      <PageHeader badge="Admin" title="Organizations" />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="dash-card p-3">
            <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              {s.label}
            </span>
            <span className="block text-lg font-semibold text-[var(--landing-text)]">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <div className="dash-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
          <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
            All Organizations
          </span>
          <span className="rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            {allOrgs.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Name
                </TableHead>
                <TableHead className="hidden sm:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Slug
                </TableHead>
                <TableHead className="hidden md:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Owner
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Plan
                </TableHead>
                <TableHead className="hidden sm:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Status
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Projects
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Members
                </TableHead>
                <TableHead className="hidden lg:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgsWithDetails.map((org) => (
                <TableRow
                  key={org.id}
                  className="border-[var(--landing-border)]"
                >
                  <TableCell>
                    <Link
                      href={`/admin/organizations/${org.slug}`}
                      className="text-sm font-medium text-[var(--landing-text)] transition-colors hover:text-[#F97316]"
                    >
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {org.slug}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-[var(--landing-text-secondary)]">
                    {org.ownerName}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
                        planBadgeStyles[org.planId] ?? planBadgeStyles.free
                      }`}
                    >
                      {org.planId}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
                        statusBadgeStyles[org.status] ?? statusBadgeStyles.active
                      }`}
                    >
                      {org.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-[var(--landing-text-secondary)]">
                    {org.projectCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-[var(--landing-text-secondary)]">
                    {org.memberCount}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {org.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
