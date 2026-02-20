import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Projects" };
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  memories,
  organizationMembers,
  projectMembers,
} from "@memctl/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { EmptyState } from "@/components/dashboard/shared/empty-state";
import { FolderOpen, Plus } from "lucide-react";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ page?: string; per_page?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const { orgSlug } = await params;
  const search = await searchParams;

  const page = Math.max(1, parseInt(search.page ?? "1", 10) || 1);
  const perPage = Math.max(
    1,
    Math.min(MAX_PER_PAGE, parseInt(search.per_page ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE),
  );
  const offset = (page - 1) * perPage;

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

  // For members, get accessible project IDs
  let accessibleIds: string[] | null = null;
  if (isMember) {
    const assignments = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.user.id));

    const orgProjectIds = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, org.id));

    const orgIdSet = new Set(orgProjectIds.map((p) => p.id));
    accessibleIds = assignments
      .map((a) => a.projectId)
      .filter((id) => orgIdSet.has(id));
  }

  const projectFilter = accessibleIds !== null
    ? accessibleIds.length > 0
      ? and(eq(projects.orgId, org.id), inArray(projects.id, accessibleIds))
      : undefined
    : eq(projects.orgId, org.id);

  // If member has no access, short-circuit
  if (accessibleIds !== null && accessibleIds.length === 0) {
    return (
      <div>
        <PageHeader
          badge="Projects"
          title="Projects"
          description="0 projects assigned"
        >
          <Button disabled className="gap-2 cursor-not-allowed opacity-40">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </PageHeader>
        <EmptyState
          icon={FolderOpen}
          title="No projects assigned"
          description="Contact your organization owner or admin to get access to projects."
        />
      </div>
    );
  }

  // Parallel: get paginated projects + total count
  const [projectList, totalResult] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(projectFilter)
      .limit(perPage)
      .offset(offset),
    db
      .select({ value: count() })
      .from(projects)
      .where(projectFilter),
  ]);

  const total = totalResult[0]?.value ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Get memory counts for current page's projects only
  const memoryCounts: Record<string, number> = {};
  await Promise.all(
    projectList.map(async (project) => {
      const [result] = await db
        .select({ value: count() })
        .from(memories)
        .where(eq(memories.projectId, project.id));
      memoryCounts[project.id] = result?.value ?? 0;
    }),
  );

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + perPage, total);

  return (
    <div>
      <PageHeader
        badge="Projects"
        title="Projects"
        description={isMember ? `${total} projects assigned` : `${total} / ${org.projectLimit} projects`}
      >
        {isMember ? (
          <Button disabled className="gap-2 cursor-not-allowed opacity-40">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        ) : (
          <Link href={`/org/${orgSlug}/projects/new`}>
            <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        )}
      </PageHeader>

      {total === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={isMember ? "No projects assigned" : "No projects yet"}
          description={isMember
            ? "Contact your organization owner or admin to get access to projects."
            : "Create your first project to start storing memories for your AI coding agents."
          }
        >
          {!isMember && (
            <Link href={`/org/${orgSlug}/projects/new`}>
              <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
                <Plus className="h-4 w-4" />
                Create your first project
              </Button>
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectList.map((project) => (
              <Link
                key={project.id}
                href={`/org/${orgSlug}/projects/${project.slug}`}
              >
                <div className="dash-card dash-card-interactive glass-border relative p-5 transition-all hover:border-[#F97316]/30">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                Showing {rangeStart}-{rangeEnd} of {total} projects
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={`/org/${orgSlug}/projects?page=${page - 1}${perPage !== DEFAULT_PER_PAGE ? `&per_page=${perPage}` : ""}`}
                  >
                    <Button
                      variant="outline"
                      className="border-[var(--landing-border)] font-mono text-xs text-[var(--landing-text-secondary)]"
                    >
                      Previous
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="border-[var(--landing-border)] font-mono text-xs"
                  >
                    Previous
                  </Button>
                )}

                <span className="font-mono text-xs text-[var(--landing-text-secondary)]">
                  Page {page} of {totalPages}
                </span>

                {page < totalPages ? (
                  <Link
                    href={`/org/${orgSlug}/projects?page=${page + 1}${perPage !== DEFAULT_PER_PAGE ? `&per_page=${perPage}` : ""}`}
                  >
                    <Button
                      variant="outline"
                      className="border-[var(--landing-border)] font-mono text-xs text-[var(--landing-text-secondary)]"
                    >
                      Next
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="border-[var(--landing-border)] font-mono text-xs"
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
