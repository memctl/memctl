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
} from "@memctl/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { SectionLabel } from "@/components/dashboard/shared/section-label";
import { Settings, Brain } from "lucide-react";
import { CopyMcpConfig } from "./copy-mcp-config";
import { MemoryBrowser } from "@/components/dashboard/memories/memory-browser";

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

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)),
    )
    .limit(1);

  if (!project) redirect(`/org/${orgSlug}`);

  const memoryList = await db
    .select()
    .from(memories)
    .where(eq(memories.projectId, project.id))
    .orderBy(desc(memories.updatedAt))
    .limit(500);

  const activeCount = memoryList.filter((m) => !m.archivedAt).length;
  const archivedCount = memoryList.filter((m) => m.archivedAt).length;

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        memctl: {
          command: "npx",
          args: ["memctl"],
          env: {
            MEMCTL_TOKEN: "<your-token>",
            MEMCTL_ORG: orgSlug,
            MEMCTL_PROJECT: projectSlug,
          },
        },
      },
    },
    null,
    2,
  );

  // Serialize for client component
  const serializedMemories = memoryList.map((m) => ({
    ...m,
    createdAt: m.createdAt?.toISOString() ?? "",
    updatedAt: m.updatedAt?.toISOString() ?? "",
    archivedAt: m.archivedAt?.toISOString() ?? null,
    expiresAt: m.expiresAt?.toISOString() ?? null,
  }));

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
        <Link href={`/org/${orgSlug}/projects/${projectSlug}/settings`}>
          <Button
            variant="outline"
            className="gap-2 border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </PageHeader>

      {/* MCP Configuration */}
      <div className="mb-8">
        <SectionLabel>MCP Configuration</SectionLabel>
        <div className="glass-border-always relative mt-3 overflow-hidden rounded-xl bg-[var(--landing-code-bg)] p-5">
          <CopyMcpConfig config={mcpConfig} />
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-[var(--landing-text-secondary)]">
            {mcpConfig}
          </pre>
        </div>
      </div>

      {/* Memory Browser */}
      <div>
        <SectionLabel>Memories</SectionLabel>
        <div className="mt-3">
          {memoryList.length === 0 ? (
            <div className="dash-card flex flex-col items-center justify-center py-12 text-center">
              <Brain className="mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
              <p className="mb-1 font-mono text-sm font-medium text-[var(--landing-text)]">
                No memories stored yet
              </p>
              <p className="text-xs text-[var(--landing-text-tertiary)]">
                Use the MCP server to store memories, or import from an
                AGENTS.md file.
              </p>
            </div>
          ) : (
            <MemoryBrowser
              memories={serializedMemories}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
            />
          )}
        </div>
      </div>
    </div>
  );
}
