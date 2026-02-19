import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";

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

  // Parallel fetches for sidebar data
  const [userMemberships, sidebarProjects, projectCountResult] =
    await Promise.all([
      // All orgs the user belongs to
      db
        .select({
          orgId: organizationMembers.orgId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, session.user.id)),
      // Current org's projects (limit 8 to show 7 + detect overflow)
      db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
        })
        .from(projects)
        .where(eq(projects.orgId, currentOrg.id))
        .limit(8),
      // Total project count
      db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.orgId, currentOrg.id)),
    ]);

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

  const totalProjectCount = projectCountResult[0]?.value ?? 0;

  return (
    <div className="flex h-screen bg-[var(--landing-bg)]">
      <Sidebar
        orgSlug={orgSlug}
        currentOrg={{
          name: currentOrg.name,
          slug: currentOrg.slug,
          planId: currentOrg.planId,
        }}
        userOrgs={userOrgs}
        projects={sidebarProjects}
        totalProjectCount={totalProjectCount}
        user={session.user}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          orgSlug={orgSlug}
          orgName={currentOrg.name}
        />
        <main className="flex-1 overflow-auto bg-[var(--landing-bg)] p-8">{children}</main>
      </div>
    </div>
  );
}
