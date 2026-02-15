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
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";

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

  if (!project) redirect(`/${orgSlug}`);

  const memoryList = await db
    .select()
    .from(memories)
    .where(eq(memories.projectId, project.id))
    .limit(100);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{project.name}</h1>
          <Badge variant="outline">{memoryList.length} memories</Badge>
        </div>
        {project.description && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
      </div>

      <div className="mb-4">
        <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-primary">
          MCP Configuration
        </h2>
        <div className="mt-2 border border-border bg-muted p-4 font-mono text-xs">
          <pre>
            {JSON.stringify(
              {
                mcpServers: {
                  memctl: {
                    command: "npx",
                    args: ["@memctl/cli"],
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
            )}
          </pre>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-primary">
          Memories
        </h2>
        {memoryList.length === 0 ? (
          <div className="border border-border p-8 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              No memories stored yet. Use the MCP server to store memories.
            </p>
          </div>
        ) : (
          <div className="border border-border">
            {memoryList.map((memory, i) => (
              <div
                key={memory.id}
                className={`p-4 ${i < memoryList.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="font-mono text-sm font-bold text-primary">
                    {memory.key}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {memory.updatedAt
                      ? new Date(memory.updatedAt).toLocaleDateString()
                      : ""}
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {memory.content.length > 200
                    ? memory.content.slice(0, 200) + "..."
                    : memory.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
