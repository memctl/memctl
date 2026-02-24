import { db } from "@/lib/db";
import {
  users,
  organizations,
  projects,
  memories,
  onboardingResponses,
} from "@memctl/db/schema";
import { count, desc, isNotNull } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getEffectivePlanId, isActiveTrial } from "@/lib/plans";
import { STRIPE_PLANS } from "@/lib/stripe";
import { OverviewCharts } from "./overview-charts";

export default async function AdminOverviewPage() {
  const [
    userCount,
    orgCount,
    projectCount,
    memoryCount,
    allUserTimestamps,
    allOrgs,
    referrerAgg,
    recentUsers,
  ] = await Promise.all([
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
    db.select({ createdAt: users.createdAt }).from(users),
    db
      .select({
        createdAt: organizations.createdAt,
        planId: organizations.planId,
        planOverride: organizations.planOverride,
        trialEndsAt: organizations.trialEndsAt,
        planExpiresAt: organizations.planExpiresAt,
        contractValue: organizations.contractValue,
      })
      .from(organizations),
    db
      .select({
        source: onboardingResponses.heardFrom,
        count: count(),
      })
      .from(onboardingResponses)
      .where(isNotNull(onboardingResponses.heardFrom))
      .groupBy(onboardingResponses.heardFrom),
    db.select().from(users).orderBy(desc(users.createdAt)).limit(10),
  ]);

  const selfHosted = process.env.SELF_HOSTED === "true";

  // Compute effective plan per org and derive revenue stats
  let mrr = 0;
  let paidOrgs = 0;
  let activeTrials = 0;

  const orgEntries = allOrgs.map((org) => {
    const effectivePlan = getEffectivePlanId(org);

    if (effectivePlan !== "free") {
      if (effectivePlan === "enterprise" && org.contractValue) {
        mrr += Math.round(org.contractValue / 12);
      } else {
        mrr += STRIPE_PLANS[effectivePlan]?.price ?? 0;
      }
      paidOrgs++;
    }

    if (isActiveTrial(org)) {
      activeTrials++;
    }

    return {
      createdAt: org.createdAt.getTime(),
      effectivePlanId: effectivePlan,
      contractValue: org.contractValue,
    };
  });

  const signupTimestamps = allUserTimestamps.map((u) => u.createdAt.getTime());

  const referrerData = referrerAgg
    .filter((r): r is typeof r & { source: string } => r.source !== null)
    .map((r) => ({ source: r.source, count: r.count }));

  // Plan breakdown for the table
  const planBreakdown: Record<string, number> = {};
  for (const org of orgEntries) {
    planBreakdown[org.effectivePlanId] =
      (planBreakdown[org.effectivePlanId] || 0) + 1;
  }

  return (
    <div>
      <PageHeader badge="Admin" title="Platform Overview" />

      <OverviewCharts
        signupTimestamps={signupTimestamps}
        orgEntries={orgEntries}
        referrerData={referrerData}
        stats={{
          users: userCount,
          orgs: orgCount,
          projects: projectCount,
          memories: memoryCount,
          mrr,
          paidOrgs,
          activeTrials,
        }}
        selfHosted={selfHosted}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent Signups */}
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-3 py-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Recent Signups
            </span>
            <span className="rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {recentUsers.length}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  User
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell">
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
                            <AvatarImage src={user.avatarUrl} alt={user.name} />
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
                    <TableCell className="hidden font-mono text-xs text-[var(--landing-text-tertiary)] sm:table-cell">
                      {user.createdAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Orgs by Plan */}
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-3 py-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Organizations by Plan
            </span>
            <span className="rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {Object.keys(planBreakdown).length}
            </span>
          </div>
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
                <TableRow key={plan} className="border-[var(--landing-border)]">
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
  );
}
