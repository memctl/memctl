import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projectMembers,
  projects,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import {
  isActiveTrial,
  daysUntilExpiry,
  planExpiresWithinDays,
  getEffectivePlanId,
} from "@/lib/plans";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  const orgName = org?.name ?? orgSlug;

  return {
    title: {
      template: `${orgName} · %s`,
      default: orgName,
    },
  };
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { orgSlug } = await params;

  // Get current org
  const [currentOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!currentOrg) {
    redirect("/");
  }

  if (currentOrg.status === "suspended") {
    redirect(`/org-suspended?slug=${orgSlug}`);
  }
  if (currentOrg.status === "banned") {
    redirect(`/org-banned?slug=${orgSlug}`);
  }

  // Get current user's org membership for role
  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, currentOrg.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember) {
    redirect("/");
  }

  const userRole = currentMember.role as "owner" | "admin" | "member";

  // Parallel fetches for sidebar data
  const [userMemberships, allOrgProjects, projectCountResult] =
    await Promise.all([
      // All orgs the user belongs to
      db
        .select({
          orgId: organizationMembers.orgId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, session.user.id)),
      // Current org's projects
      db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
        })
        .from(projects)
        .where(eq(projects.orgId, currentOrg.id)),
      // Total project count
      db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.orgId, currentOrg.id)),
    ]);

  // Filter projects for members by their assignments
  let sidebarProjects = allOrgProjects;
  if (userRole === "member") {
    const assignments = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.user.id));

    const assignedIds = new Set(assignments.map((a) => a.projectId));
    sidebarProjects = allOrgProjects.filter((p) => assignedIds.has(p.id));
  }

  // Limit for sidebar display (7 visible + detect overflow)
  const filteredCount = sidebarProjects.length;
  sidebarProjects = sidebarProjects.slice(0, 8);

  // Fetch org details for all user memberships
  const userOrgs = await Promise.all(
    userMemberships.map(async (m) => {
      const [org] = await db
        .select({
          name: organizations.name,
          slug: organizations.slug,
          planId: organizations.planId,
        })
        .from(organizations)
        .where(eq(organizations.id, m.orgId))
        .limit(1);
      return org;
    }),
  ).then((orgs) => orgs.filter(Boolean));

  const totalProjectCount =
    userRole === "member" ? filteredCount : (projectCountResult[0]?.value ?? 0);

  const trialActive = isActiveTrial(currentOrg);
  const trialDays = trialActive ? daysUntilExpiry(currentOrg) : null;
  const expiringWithin7 = planExpiresWithinDays(currentOrg, 7);
  const expiryDays = expiringWithin7 ? daysUntilExpiry(currentOrg) : null;
  const effectivePlan = getEffectivePlanId(currentOrg);
  const planExpired =
    !trialActive &&
    (currentOrg.planExpiresAt || currentOrg.trialEndsAt) &&
    effectivePlan === "free" &&
    (currentOrg.planOverride !== null || currentOrg.trialEndsAt !== null);

  return (
    <DashboardShell
      orgSlug={orgSlug}
      orgName={currentOrg.name}
      sidebarProps={{
        orgSlug,
        currentOrg: {
          name: currentOrg.name,
          slug: currentOrg.slug,
          planId: currentOrg.planId,
        },
        userOrgs,
        projects: sidebarProjects,
        totalProjectCount,
        user: session.user,
        userRole,
      }}
    >
      {trialActive && trialDays !== null && (
        <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 font-mono text-[11px] text-amber-500">
          Trial ends in {trialDays} day{trialDays !== 1 ? "s" : ""}.
        </div>
      )}
      {!trialActive && expiringWithin7 && expiryDays !== null && (
        <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 font-mono text-[11px] text-amber-500">
          Plan expires in {expiryDays} day{expiryDays !== 1 ? "s" : ""}.
        </div>
      )}
      {planExpired && (
        <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2.5 font-mono text-[11px] text-red-500">
          Plan expired, downgraded to Free.
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
