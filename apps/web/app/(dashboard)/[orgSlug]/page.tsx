import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  organizationMembers,
} from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function OrgDashboardPage({
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold">{org.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">
            {projectList.length} / {org.projectLimit} projects
          </p>
        </div>
        <Link href={`/${orgSlug}/projects/new`}>
          <Button>New project</Button>
        </Link>
      </div>

      {projectList.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <p className="mb-4 font-mono text-sm text-muted-foreground">
            No projects yet
          </p>
          <Link href={`/${orgSlug}/projects/new`}>
            <Button variant="outline">Create your first project</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <Link
              key={project.id}
              href={`/${orgSlug}/projects/${project.slug}`}
              className="border border-border p-4 transition-colors hover:bg-muted"
            >
              <h3 className="font-mono text-sm font-bold">{project.name}</h3>
              <p className="font-mono text-xs text-muted-foreground">
                {project.slug}
              </p>
              {project.description && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {project.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
