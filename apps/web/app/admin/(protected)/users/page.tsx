import { db } from "@/lib/db";
import { users, organizationMembers } from "@memctl/db/schema";
import { eq, count } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { UsersList } from "./users-list";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [[totalResult], [adminResult], [withOrgsResult]] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(users).where(eq(users.isAdmin, true)),
    db
      .select({ value: count() })
      .from(
        db
          .selectDistinct({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .as("distinct_members"),
      ),
  ]);

  const totalCount = totalResult?.value ?? 0;
  const withOrgsCount = withOrgsResult?.value ?? 0;

  const stats = [
    { label: "Total", value: totalCount },
    { label: "Admins", value: adminResult?.value ?? 0 },
    { label: "With Orgs", value: withOrgsCount },
    { label: "No Orgs", value: totalCount - withOrgsCount },
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

      <UsersList />
    </div>
  );
}
