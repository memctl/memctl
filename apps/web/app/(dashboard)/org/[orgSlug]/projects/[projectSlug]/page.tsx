import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  memories,
  organizationMembers,
  projectMembers,
} from "@memctl/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { ProjectTabs } from "./project-tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, projectSlug } = await params;

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return { title: "Project" };

  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const { orgSlug, projectSlug } = await params;

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

  const isMember = member.role === "member";
  const isAdmin = !isMember;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  if (!project) redirect(`/org/${orgSlug}`);

  // Check project-level access for members
  if (isMember) {
    const [assignment] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!assignment) redirect(`/org/${orgSlug}`);
  }

  // Lightweight count queries instead of fetching all rows
  const [counts] = await db
    .select({
      active: sql<number>`SUM(CASE WHEN ${memories.archivedAt} IS NULL THEN 1 ELSE 0 END)`,
      archived: sql<number>`SUM(CASE WHEN ${memories.archivedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(memories)
    .where(eq(memories.projectId, project.id));

  const activeCount = counts?.active ?? 0;
  const archivedCount = counts?.archived ?? 0;

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        memctl: {
          command: "npx",
          args: ["memctl"],
          env: {
            MEMCTL_ORG: orgSlug,
            MEMCTL_PROJECT: projectSlug,
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <div>
      <PageHeader
        badge="Project"
        title={project.name}
        description={project.description ?? undefined}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#F97316]/10 px-2.5 py-1 font-mono text-xs font-medium text-[#F97316]">
            {activeCount} memories
          </span>
          {archivedCount > 0 && (
            <span className="rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--landing-text-tertiary)]">
              {archivedCount} archived
            </span>
          )}
        </div>
      </PageHeader>

      <ProjectTabs
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        projectId={project.id}
        isAdmin={isAdmin}
        currentUserId={session.user.id}
        mcpConfig={mcpConfig}
        activeCount={activeCount}
        archivedCount={archivedCount}
        settingsData={{
          name: project.name,
          description: project.description,
          slug: project.slug,
          createdAt: project.createdAt?.toISOString() ?? "",
        }}
      />
    </div>
  );
}
