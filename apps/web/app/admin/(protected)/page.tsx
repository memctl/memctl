import { db } from "@/lib/db";
import {
  users,
  organizations,
  projects,
  memories,
} from "@memctl/db/schema";
import { count, desc } from "drizzle-orm";
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
  Users,
  Building2,
  FolderOpen,
  Brain,
  Activity,
} from "lucide-react";

export default async function AdminOverviewPage() {
  const [userCount, orgCount, projectCount, memoryCount] = await Promise.all([
    db
      .select({ value: count() })
      .from(users)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(organizations)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(projects)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(memories)
      .then((r) => r[0]?.value ?? 0),
  ]);

  // Recent signups (last 10 users)
  const recentUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10);

  // Orgs by plan
  const allOrgs = await db.select().from(organizations);
  const planBreakdown: Record<string, number> = {};
  for (const org of allOrgs) {
    planBreakdown[org.planId] = (planBreakdown[org.planId] || 0) + 1;
  }

  return (
    <div>
      <PageHeader badge="Admin" title="Platform Overview" />

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Users} label="Total Users" value={userCount} />
        <StatCard icon={Building2} label="Organizations" value={orgCount} />
        <StatCard icon={FolderOpen} label="Projects" value={projectCount} />
        <StatCard
          icon={Brain}
          label="Memories"
          value={memoryCount.toLocaleString()}
        />
        <StatCard icon={Activity} label="System Health" value="OK" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Signups */}
        <div>
          <SectionLabel>Recent Signups</SectionLabel>
          <div className="dash-card mt-3 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    User
                  </TableHead>
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Joined
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUsers.map((user) => {
                  const initials = user.name
                    ? user.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "?";
                  return (
                    <TableRow
                      key={user.id}
                      className="border-[var(--landing-border)]"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7 border border-[var(--landing-border)]">
                            {user.avatarUrl && (
                              <AvatarImage
                                src={user.avatarUrl}
                                alt={user.name}
                              />
                            )}
                            <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-[10px] text-[var(--landing-text-secondary)]">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-[var(--landing-text)]">
                              {user.name}
                            </p>
                            <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                        {user.createdAt.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Orgs by Plan */}
        <div>
          <SectionLabel>Organizations by Plan</SectionLabel>
          <div className="dash-card mt-3 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Plan
                  </TableHead>
                  <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Count
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(planBreakdown).map(([plan, planCount]) => (
                  <TableRow
                    key={plan}
                    className="border-[var(--landing-border)]"
                  >
                    <TableCell className="font-mono text-sm font-medium capitalize text-[var(--landing-text)]">
                      {plan}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[var(--landing-text-secondary)]">
                      {planCount}
                    </TableCell>
                  </TableRow>
                ))}
                {Object.keys(planBreakdown).length === 0 && (
                  <TableRow className="border-[var(--landing-border)]">
                    <TableCell
                      colSpan={2}
                      className="py-8 text-center font-mono text-sm text-[var(--landing-text-tertiary)]"
                    >
                      No organizations yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
