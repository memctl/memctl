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
import { SectionLabel } from "@/components/dashboard/shared/section-label";
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

  return (
    <div>
      <PageHeader
        badge="Billing"
        title="Billing"
        description="Manage your subscription and plan."
      />

      {/* Current Plan */}
      <div className="glass-border-always glow-orange relative mb-8 overflow-hidden rounded-xl bg-[var(--landing-surface)] p-6">
        <div className="flex items-center gap-3">
          <SectionLabel>Current Plan</SectionLabel>
          <span className="rounded-md bg-[#F97316]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#F97316]">
            {currentPlan.name}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
              Projects
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--landing-text)]">
              {currentPlan.projectLimit === Infinity
                ? "Unlimited"
                : currentPlan.projectLimit}
            </p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
              Members
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--landing-text)]">
              {currentPlan.memberLimit === Infinity
                ? "Unlimited"
                : currentPlan.memberLimit}
            </p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
              Memories/project
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--landing-text)]">
              {currentPlan.memoryLimit === Infinity
                ? "Unlimited"
                : currentPlan.memoryLimit.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
              API calls/mo
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--landing-text)]">
              {currentPlan.apiCallLimit === Infinity
                ? "Unlimited"
                : currentPlan.apiCallLimit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <BillingActions
        orgSlug={orgSlug}
        currentPlan={org.planId}
        hasSubscription={!!org.stripeSubscriptionId}
      />

      {/* Plan Comparison */}
      <div className="mt-8">
        <SectionLabel>All Plans</SectionLabel>
        <div className="dash-card mt-3 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Plan
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Price/mo
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Projects
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Members
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Memories
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
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
                    className={`border-[var(--landing-border)] ${
                      isCurrent
                        ? "border-l-2 border-l-[#F97316] bg-[#F97316]/5"
                        : ""
                    }`}
                  >
                    <TableCell className="font-mono text-sm font-bold text-[var(--landing-text)]">
                      {plan.name}
                      {isCurrent && (
                        <span className="ml-2 text-[#F97316]">(current)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[var(--landing-text-secondary)]">
                      {plan.price === -1 ? "Custom" : `$${plan.price}`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[var(--landing-text-secondary)]">
                      {plan.projectLimit === Infinity
                        ? "Unlimited"
                        : plan.projectLimit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[var(--landing-text-secondary)]">
                      {plan.memberLimit === Infinity
                        ? "Unlimited"
                        : plan.memberLimit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[var(--landing-text-secondary)]">
                      {plan.memoryLimit === Infinity
                        ? "Unlimited"
                        : plan.memoryLimit.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-[var(--landing-text-secondary)]">
                      {plan.apiCallLimit === Infinity
                        ? "Unlimited"
                        : plan.apiCallLimit.toLocaleString()}
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
