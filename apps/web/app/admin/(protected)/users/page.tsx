import { db } from "@/lib/db";
import { users, organizationMembers } from "@memctl/db/schema";
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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { UserAdminToggle } from "./user-admin-toggle";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const allUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));

  const orgCounts: Record<string, number> = {};
  for (const user of allUsers) {
    const [result] = await db
      .select({ value: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id));
    orgCounts[user.id] = result?.value ?? 0;
  }

  const adminCount = allUsers.filter((u) => u.isAdmin).length;
  const usersWithOrgs = allUsers.filter((u) => (orgCounts[u.id] ?? 0) > 0).length;
  const usersWithoutOrgs = allUsers.length - usersWithOrgs;

  const stats = [
    { label: "Total", value: allUsers.length },
    { label: "Admins", value: adminCount },
    { label: "With Orgs", value: usersWithOrgs },
    { label: "No Orgs", value: usersWithoutOrgs },
  ];

  return (
    <div>
      <PageHeader badge="Admin" title="Users" />

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
            All Users
          </span>
          <span className="rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            {allUsers.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  User
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Email
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Admin
                </TableHead>
                <TableHead className="hidden md:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  GitHub ID
                </TableHead>
                <TableHead className="hidden sm:table-cell text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Orgs
                </TableHead>
                <TableHead className="hidden lg:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.map((user) => {
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
                        <Avatar className="h-8 w-8 border border-[var(--landing-border)]">
                          {user.avatarUrl && (
                            <AvatarImage
                              src={user.avatarUrl}
                              alt={user.name}
                            />
                          )}
                          <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-xs text-[var(--landing-text-secondary)]">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-[var(--landing-text)]">
                          {user.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--landing-text-secondary)]">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <UserAdminToggle
                        userId={user.id}
                        initialIsAdmin={!!user.isAdmin}
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                      {user.githubId ?? "\u2014"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right font-mono text-xs text-[var(--landing-text-secondary)]">
                      {orgCounts[user.id] ?? 0}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                      {user.createdAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
