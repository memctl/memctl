import { db } from "@/lib/db";
import { organizations } from "@memctl/db/schema";
import { eq, count, and, ne } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { OrganizationsList } from "./organizations-list";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  const [
    [totalResult],
    [activeResult],
    [suspendedBannedResult],
    [proPlusResult],
  ] = await Promise.all([
    db.select({ value: count() }).from(organizations),
    db
      .select({ value: count() })
      .from(organizations)
      .where(eq(organizations.status, "active")),
    db
      .select({ value: count() })
      .from(organizations)
      .where(and(ne(organizations.status, "active"))),
    db
      .select({ value: count() })
      .from(organizations)
      .where(ne(organizations.planId, "free")),
  ]);

  const stats = [
    { label: "Total Orgs", value: totalResult?.value ?? 0 },
    { label: "Active", value: activeResult?.value ?? 0 },
    { label: "Suspended/Banned", value: suspendedBannedResult?.value ?? 0 },
    { label: "Pro+", value: proPlusResult?.value ?? 0 },
  ];

  return (
    <div>
      <PageHeader badge="Admin" title="Organizations" />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="dash-card p-3">
            <span className="block font-mono text-[9px] tracking-widest text-[var(--landing-text-tertiary)] uppercase">
              {s.label}
            </span>
            <span className="block text-lg font-semibold text-[var(--landing-text)]">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <OrganizationsList />
    </div>
  );
}
