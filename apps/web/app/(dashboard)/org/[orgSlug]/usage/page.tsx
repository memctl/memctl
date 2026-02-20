import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Usage" };
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  memories,
  organizationMembers,
  apiTokens,
} from "@memctl/db/schema";
import { eq, and, count, isNull } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { SectionLabel } from "@/components/dashboard/shared/section-label";
import { Progress } from "@/components/ui/progress";
import { UsageCharts } from "./usage-charts";

export default async function UsagePage({
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

  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  const [memberCount] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const [tokenCount] = await db
    .select({ value: count() })
    .from(apiTokens)
    .where(
      and(eq(apiTokens.orgId, org.id), isNull(apiTokens.revokedAt)),
    );

  // Memory counts per project
  const memoryByProject: { name: string; count: number }[] = [];
  let totalMemories = 0;
  for (const project of projectList) {
    const [result] = await db
      .select({ value: count() })
      .from(memories)
      .where(eq(memories.projectId, project.id));
    const memCount = result?.value ?? 0;
    totalMemories += memCount;
    memoryByProject.push({ name: project.name, count: memCount });
  }

  const usageItems = [
    {
      label: "Projects",
      current: projectList.length,
      limit: currentPlan.projectLimit,
    },
    {
      label: "Members",
      current: memberCount?.value ?? 0,
      limit: currentPlan.memberLimit,
    },
    {
      label: "Memories",
      current: totalMemories,
      limit: currentPlan.memoryLimitOrg,
    },
    {
      label: "API Calls",
      current: 0,
      limit: currentPlan.apiCallLimit,
    },
  ];

  return (
    <div>
      <PageHeader
        badge="Usage"
        title="Usage & Analytics"
        description={`${currentPlan.name} plan`}
      />

      {/* Plan Usage */}
      <div className="mb-8">
        <SectionLabel>Plan Usage</SectionLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {usageItems.map((item) => {
            const isUnlimited = item.limit === Infinity;
            const percentage = isUnlimited
              ? 0
              : Math.min((item.current / item.limit) * 100, 100);

            return (
              <div key={item.label} className="dash-card glass-border relative p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-[var(--landing-text)]">
                    {item.label}
                  </span>
                  <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {item.current.toLocaleString()} /{" "}
                    {isUnlimited
                      ? "Unlimited"
                      : item.limit.toLocaleString()}
                  </span>
                </div>
                <Progress
                  value={isUnlimited ? 0 : percentage}
                  className="h-2 bg-[var(--landing-surface-2)] [&>div]:bg-[#F97316]"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <UsageCharts memoryByProject={memoryByProject} />
    </div>
  );
}
