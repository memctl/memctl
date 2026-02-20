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
import { BillingClient } from "@/components/dashboard/billing-client";

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

  const planId = (org.planId as PlanId) ?? "free";
  const currentPlan = PLANS[planId] ?? PLANS.free;

  const formatLimit = (val: number) =>
    val === Infinity ? "Unlimited" : val.toLocaleString();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Billing"
        description="Manage your subscription and plan."
      />

      {/* Current Plan Card */}
      <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
        <div>
          <p className="text-xs text-[var(--landing-text-tertiary)]">
            Current plan
          </p>
          <p className="mt-0.5 text-lg font-semibold text-[var(--landing-text)]">
            {currentPlan.name}
            {currentPlan.price > 0 && (
              <span className="ml-2 text-sm font-normal text-[var(--landing-text-secondary)]">
                ${currentPlan.price}/mo
              </span>
            )}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { label: "Projects", value: formatLimit(currentPlan.projectLimit) },
            { label: "Members", value: formatLimit(currentPlan.memberLimit) },
            {
              label: "Memories / project",
              value: formatLimit(currentPlan.memoryLimitPerProject),
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

      <BillingClient
        orgSlug={orgSlug}
        currentPlan={planId}
        hasSubscription={!!org.stripeSubscriptionId}
        plans={PLANS}
      />
    </div>
  );
}
