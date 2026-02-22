import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Webhooks" };

import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  webhookConfigs,
} from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { WebhookManager } from "./webhook-manager";

export default async function WebhooksPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { orgSlug } = await params;

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) redirect("/");

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, org.id), eq(organizationMembers.userId, session.user.id)))
    .limit(1);
  if (!member) redirect("/");

  const projectList = await db.select().from(projects).where(eq(projects.orgId, org.id));

  // Gather webhooks across all projects
  const allWebhooks: Array<{
    id: string;
    url: string;
    events: string | null;
    digestIntervalMinutes: number | null;
    isActive: boolean | null;
    secret: string | null;
    lastSentAt: string | null;
    createdAt: string;
    projectSlug: string;
    projectName: string;
    consecutiveFailures: number;
  }> = [];

  for (const project of projectList) {
    const hooks = await db.select().from(webhookConfigs).where(eq(webhookConfigs.projectId, project.id));

    for (const h of hooks) {
      allWebhooks.push({
        id: h.id,
        url: h.url,
        events: h.events,
        digestIntervalMinutes: h.digestIntervalMinutes,
        isActive: h.isActive,
        secret: h.secret ? "••••••" : null,
        lastSentAt: h.lastSentAt?.toISOString() ?? null,
        createdAt: h.createdAt?.toISOString() ?? "",
        projectSlug: project.slug,
        projectName: project.name,
        consecutiveFailures: h.consecutiveFailures,
      });
    }
  }

  return (
    <div>
      <PageHeader title="Webhooks" description="Digest webhook notifications for memory changes" />

      <WebhookManager
        webhooks={allWebhooks}
        projects={projectList.map((p) => ({ slug: p.slug, name: p.name }))}
        orgSlug={orgSlug}
      />
    </div>
  );
}
