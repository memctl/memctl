import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { OrgSettingsForm } from "@/components/dashboard/org-settings-form";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import Link from "next/link";

export default async function OrgSettingsPage({
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

  if (!member || member.role === "member") redirect(`/org/${orgSlug}`);

  const [[projectCount], [memberCount]] = await Promise.all([
    db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, org.id)),
    db
      .select({ count: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.orgId, org.id)),
  ]);

  const planId = (org.planId as PlanId) ?? "free";
  const plan = PLANS[planId] ?? PLANS.free;

  const formatLimit = (val: number) =>
    val === Infinity ? "Unlimited" : val.toLocaleString();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Manage your organization." />

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Settings form — 3 cols */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <OrgSettingsForm
              orgSlug={orgSlug}
              initialName={org.name}
              initialCompanyName={org.companyName ?? ""}
              initialTaxId={org.taxId ?? ""}
            />
          </div>
        </div>

        {/* Plan & Usage — 2 cols */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-[var(--landing-text)]">
                Plan & Usage
              </h2>
              <Link
                href={`/org/${orgSlug}/billing`}
                className="text-xs text-[#F97316] hover:underline"
              >
                Manage billing →
              </Link>
            </div>

            <div className="mt-5">
              <p className="text-xs text-[var(--landing-text-tertiary)]">
                Current plan
              </p>
              <p className="mt-0.5 text-sm font-medium text-[var(--landing-text)]">
                {plan.name}
                {plan.price > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-[var(--landing-text-secondary)]">
                    ${plan.price}/mo
                  </span>
                )}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs text-[var(--landing-text-tertiary)]">
                  Projects
                </p>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <p className="text-sm font-medium text-[var(--landing-text)]">
                    {projectCount!.count}{" "}
                    <span className="text-xs font-normal text-[var(--landing-text-tertiary)]">
                      / {formatLimit(plan.projectLimit)}
                    </span>
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--landing-border)]">
                  <div
                    className="h-1.5 rounded-full bg-[#F97316]"
                    style={{
                      width: `${Math.min(100, (projectCount!.count / (plan.projectLimit === Infinity ? 1 : plan.projectLimit)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-[var(--landing-text-tertiary)]">
                  Members
                </p>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <p className="text-sm font-medium text-[var(--landing-text)]">
                    {memberCount!.count}{" "}
                    <span className="text-xs font-normal text-[var(--landing-text-tertiary)]">
                      / {formatLimit(plan.memberLimit)}
                    </span>
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--landing-border)]">
                  <div
                    className="h-1.5 rounded-full bg-[#F97316]"
                    style={{
                      width: `${Math.min(100, (memberCount!.count / (plan.memberLimit === Infinity ? 1 : plan.memberLimit)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
