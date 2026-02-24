import { db } from "@/lib/db";
import {
  memories,
  organizations,
  organizationMembers,
  projectMembers,
  projects,
} from "@memctl/db/schema";
import { getOrgLimits, isUnlimited } from "@/lib/plans";
import { and, count, eq, isNull } from "drizzle-orm";

export async function resolveOrgAndProject(
  orgSlug: string,
  projectSlug: string,
  userId?: string,
) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return null;
  if (org.status !== "active") return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  if (!project) return null;

  // If userId provided, check project-level access for members
  if (userId) {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.orgId, org.id),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!member) return null;

    // Owner/admin bypass project-level checks
    if (member.role === "member") {
      const [assignment] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            eq(projectMembers.userId, userId),
          ),
        )
        .limit(1);

      if (!assignment) return null;
    }
  }

  return { org, project };
}

/**
 * Get memory capacity for a specific project.
 * Per-project limit is the hard block. No org-wide limit.
 */
export async function getOrgMemoryCapacity(
  org: {
    id: string;
    planId: string;
    planOverride: string | null;
    projectLimit: number;
    memberLimit: number;
    memoryLimitPerProject: number | null;
    apiRatePerMinute: number | null;
  },
  projectId: string,
) {
  const limits = getOrgLimits(org);
  const limit = limits.memoryLimitPerProject;

  const [projectCount] = await db
    .select({ value: count() })
    .from(memories)
    .where(
      and(eq(memories.projectId, projectId), isNull(memories.archivedAt)),
    );
  const used = projectCount?.value ?? 0;

  const isFull = !isUnlimited(limit) && used >= limit;
  const isApproaching = !isUnlimited(limit) && used >= limit * 0.8;

  return {
    used,
    limit,
    isFull,
    isApproaching,
    usageRatio:
      !isUnlimited(limit) && limit > 0 ? Math.min(1, used / limit) : null,
  };
}
