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
import { isSelfHosted, getOrgLimits, isUnlimited } from "@/lib/plans";
import {
  Server,
  Infinity as InfinityIcon,
  Shield,
  Check,
  FolderOpen,
  Users,
  Brain,
  Zap,
  Lock,
  Database,
  Globe,
} from "lucide-react";

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

  if (member.role === "member") {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Billing"
          description="Manage your subscription and plan."
        />
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h2 className="mb-2 font-mono text-base font-semibold text-[var(--landing-text)]">
              You don&apos;t have permission to view this page.
            </h2>
            <p className="text-sm text-[var(--landing-text-tertiary)]">
              Contact your organization owner or admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const planId = (org.planId as PlanId) ?? "free";
  const currentPlan = PLANS[planId] ?? PLANS.free;
  const limits = getOrgLimits(org);

  const formatLimit = (val: number) =>
    isUnlimited(val) ? "Unlimited" : val.toLocaleString();

  const selfHosted = isSelfHosted();

  if (selfHosted) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Billing" description="Self-hosted deployment" />

        {/* Status banner */}
        <div className="dash-card glass-border-always relative mb-4 overflow-hidden p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/30 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#F97316]/10 p-2.5 shadow-[0_0_12px_rgba(249,115,22,0.08)]">
              <Server className="h-5 w-5 text-[#F97316]" />
            </div>
            <div className="flex-1">
              <p className="font-mono text-sm font-semibold text-[var(--landing-text)]">
                Self-Hosted Enterprise
              </p>
              <p className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                All features unlocked. No billing required.
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="font-mono text-[10px] font-medium text-emerald-400">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Limits grid */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              icon: FolderOpen,
              label: "Projects",
              color: "text-[var(--landing-text)]",
            },
            { icon: Users, label: "Members", color: "text-blue-400" },
            { icon: Brain, label: "Memories", color: "text-[#F97316]" },
            { icon: Zap, label: "API Calls", color: "text-emerald-400" },
          ].map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="dash-card glass-border relative overflow-hidden p-3"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/20 to-transparent" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[9px] tracking-widest text-[var(--landing-text-tertiary)] uppercase">
                    {label}
                  </p>
                  <p
                    className={`mt-1 flex items-center gap-1 font-mono text-lg font-bold ${color}`}
                  >
                    <InfinityIcon className="h-4 w-4" />
                  </p>
                  <p className="font-mono text-[10px] text-[#F97316]">
                    unlimited
                  </p>
                </div>
                <div className="rounded-lg bg-[#F97316]/10 p-2 shadow-[0_0_8px_rgba(249,115,22,0.06)]">
                  <Icon className="h-4 w-4 text-[#F97316]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features included */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="dash-card overflow-hidden">
            <div className="border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-3 py-2">
              <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">
                Included Features
              </span>
            </div>
            <div className="divide-y divide-[var(--landing-border)]">
              {[
                { icon: Shield, text: "Invite-only access control" },
                { icon: Database, text: "Your own database" },
                { icon: Globe, text: "Custom domain support" },
                { icon: Lock, text: "Full data ownership" },
                { icon: Zap, text: "No rate limiting" },
                { icon: Brain, text: "Unlimited memory storage" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 px-3 py-2">
                  <Check className="h-3 w-3 shrink-0 text-[#F97316]" />
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--landing-text-tertiary)]" />
                  <span className="font-mono text-[11px] text-[var(--landing-text-secondary)]">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-card overflow-hidden">
            <div className="border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-3 py-2">
              <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">
                Deployment Info
              </span>
            </div>
            <div className="divide-y divide-[var(--landing-border)]">
              {[
                { label: "Plan", value: currentPlan.name },
                { label: "Billing", value: "Disabled" },
                { label: "Auth mode", value: "Invite-only" },
                { label: "Projects", value: formatLimit(limits.projectLimit) },
                { label: "Members", value: formatLimit(limits.memberLimit) },
                {
                  label: "Memories / project",
                  value: formatLimit(limits.memoryLimitPerProject),
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                    {label}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            { label: "Projects", value: formatLimit(limits.projectLimit) },
            { label: "Members", value: formatLimit(limits.memberLimit) },
            {
              label: "Memories / project",
              value: formatLimit(limits.memoryLimitPerProject),
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
