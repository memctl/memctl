import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Billing" };
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { BillingActions } from "@/components/dashboard/billing-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function BillingPage({
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

  const currentPlan = PLANS[org.planId as PlanId] ?? PLANS.free;

  const formatLimit = (val: number) =>
    val === Infinity ? "Unlimited" : val.toLocaleString();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Billing"
        description="Manage your subscription and plan."
      />

      <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--landing-text-tertiary)]">
              Current plan
            </p>
            <p className="mt-0.5 text-lg font-semibold text-[var(--landing-text)]">
              {currentPlan.name}
            </p>
          </div>
          <BillingActions
            orgSlug={orgSlug}
            currentPlan={org.planId}
            hasSubscription={!!org.stripeSubscriptionId}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { label: "Projects", value: formatLimit(currentPlan.projectLimit) },
            { label: "Members", value: formatLimit(currentPlan.memberLimit) },
            {
              label: "Memories / project",
              value: formatLimit(currentPlan.memoryLimit),
            },
            {
              label: "API calls / month",
              value: formatLimit(currentPlan.apiCallLimit),
            },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-[var(--landing-text-tertiary)]">
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--landing-text)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-[var(--landing-text)]">
          All plans
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--landing-border)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] hover:bg-transparent">
                <TableHead className="text-xs text-[var(--landing-text-tertiary)]">
                  Plan
                </TableHead>
                <TableHead className="text-right text-xs text-[var(--landing-text-tertiary)]">
                  Price
                </TableHead>
                <TableHead className="text-right text-xs text-[var(--landing-text-tertiary)]">
                  Projects
                </TableHead>
                <TableHead className="text-right text-xs text-[var(--landing-text-tertiary)]">
                  Members
                </TableHead>
                <TableHead className="text-right text-xs text-[var(--landing-text-tertiary)]">
                  Memories
                </TableHead>
                <TableHead className="text-right text-xs text-[var(--landing-text-tertiary)]">
                  API Calls
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(PLANS).map(([id, plan]) => {
                const isCurrent = id === org.planId;
                return (
                  <TableRow
                    key={id}
                    className={`border-[var(--landing-border)] ${isCurrent ? "bg-[#F97316]/5" : ""}`}
                  >
                    <TableCell className="text-sm font-medium text-[var(--landing-text)]">
                      {plan.name}
                      {isCurrent && (
                        <span className="ml-2 text-xs text-[#F97316]">
                          Current
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--landing-text-secondary)]">
                      {plan.price === -1
                        ? "Custom"
                        : plan.price === 0
                          ? "Free"
                          : `$${plan.price}/mo`}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--landing-text-secondary)]">
                      {formatLimit(plan.projectLimit)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--landing-text-secondary)]">
                      {formatLimit(plan.memberLimit)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--landing-text-secondary)]">
                      {formatLimit(plan.memoryLimit)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--landing-text-secondary)]">
                      {formatLimit(plan.apiCallLimit)}
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
