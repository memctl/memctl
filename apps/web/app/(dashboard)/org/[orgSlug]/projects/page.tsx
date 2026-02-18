import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  memories,
  organizationMembers,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { EmptyState } from "@/components/dashboard/shared/empty-state";
import { FolderOpen, Plus } from "lucide-react";

export default async function ProjectsPage({
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

  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  // Get memory counts per project
  const memoryCounts: Record<string, number> = {};
  for (const project of projectList) {
    const [result] = await db
      .select({ value: count() })
      .from(memories)
      .where(eq(memories.projectId, project.id));
    memoryCounts[project.id] = result?.value ?? 0;
  }

  return (
    <div>
      <PageHeader
        badge="Projects"
        title="Projects"
        description={`${projectList.length} / ${org.projectLimit} projects`}
      >
        <Link href={`/${orgSlug}/projects/new`}>
          <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </PageHeader>

      {projectList.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to start storing memories for your AI coding agents."
        >
          <Link href={`/${orgSlug}/projects/new`}>
            <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
              <Plus className="h-4 w-4" />
              Create your first project
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <Link
              key={project.id}
              href={`/${orgSlug}/projects/${project.slug}`}
            >
              <div className="dash-card glass-border relative p-5 transition-all hover:border-[#F97316]/30">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-mono text-sm font-bold text-[var(--landing-text)]">
                      {project.name}
                    </h3>
                    <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                      {project.slug}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#F97316]/10 px-2 py-0.5 font-mono text-[11px] font-medium text-[#F97316]">
                    {memoryCounts[project.id] ?? 0} memories
                  </span>
                </div>
                {project.description && (
                  <p className="mt-3 text-xs leading-relaxed text-[var(--landing-text-secondary)]">
                    {project.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
