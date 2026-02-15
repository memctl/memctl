import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "@/components/dashboard/billing-actions";

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
      <h1 className="mb-6 font-mono text-2xl font-bold">Billing</h1>

      <div className="mb-8 border border-border p-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-muted-foreground">
            Current plan:
          </span>
          <Badge>{currentPlan.name}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 font-mono text-sm md:grid-cols-4">
          <div>
            <div className="text-muted-foreground">Projects</div>
            <div className="text-lg font-bold">
              {currentPlan.projectLimit === Infinity
                ? "Unlimited"
                : currentPlan.projectLimit}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Members</div>
            <div className="text-lg font-bold">
              {currentPlan.memberLimit === Infinity
                ? "Unlimited"
                : currentPlan.memberLimit}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Memories/project</div>
            <div className="text-lg font-bold">
              {currentPlan.memoryLimit === Infinity
                ? "Unlimited"
                : currentPlan.memoryLimit.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">API calls/mo</div>
            <div className="text-lg font-bold">
              {currentPlan.apiCallLimit === Infinity
                ? "Unlimited"
                : currentPlan.apiCallLimit.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <BillingActions
        orgSlug={orgSlug}
        currentPlan={org.planId}
        hasSubscription={!!org.stripeSubscriptionId}
      />

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse border border-border font-mono text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="border-r border-border px-4 py-3 text-left">Plan</th>
              <th className="border-r border-border px-4 py-3 text-right">Price/mo</th>
              <th className="border-r border-border px-4 py-3 text-right">Projects</th>
              <th className="border-r border-border px-4 py-3 text-right">Members</th>
              <th className="border-r border-border px-4 py-3 text-right">Memories</th>
              <th className="px-4 py-3 text-right">API calls</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PLANS).map(([id, plan]) => (
              <tr
                key={id}
                className={`border-b border-border ${id === org.planId ? "bg-muted" : ""}`}
              >
                <td className="border-r border-border px-4 py-3 font-bold">
                  {plan.name}
                  {id === org.planId && (
                    <span className="ml-2 text-primary">(current)</span>
                  )}
                </td>
                <td className="border-r border-border px-4 py-3 text-right text-muted-foreground">
                  {plan.price === -1 ? "Custom" : `$${plan.price}`}
                </td>
                <td className="border-r border-border px-4 py-3 text-right text-muted-foreground">
                  {plan.projectLimit === Infinity ? "Unlimited" : plan.projectLimit}
                </td>
                <td className="border-r border-border px-4 py-3 text-right text-muted-foreground">
                  {plan.memberLimit === Infinity ? "Unlimited" : plan.memberLimit}
                </td>
                <td className="border-r border-border px-4 py-3 text-right text-muted-foreground">
                  {plan.memoryLimit === Infinity
                    ? "Unlimited"
                    : plan.memoryLimit.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {plan.apiCallLimit === Infinity
                    ? "Unlimited"
                    : plan.apiCallLimit.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
