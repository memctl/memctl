import { db } from "@/lib/db";
import {
  memories,
  organizations,
  organizationMembers,
  projectMembers,
  projects,
} from "@memctl/db/schema";
import { getOrgLimits, isUnlimited } from "@/lib/plans";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

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
 * Returns both project-level soft limit and org-level hard limit.
 *
 * - softLimit (per-project): agents get a warning when approaching this
 * - hardLimit (org-wide): actual storage block when reached
 */
export async function getOrgMemoryCapacity(
  org: {
    id: string;
    planId: string;
    planOverride: string | null;
    projectLimit: number;
    memberLimit: number;
    memoryLimitPerProject: number | null;
    memoryLimitOrg: number | null;
    apiRatePerMinute: number | null;
  },
  projectId?: string,
) {
  const limits = getOrgLimits(org);
  const softLimit = limits.memoryLimitPerProject;
  const hardLimit = limits.memoryLimitOrg;

  // Count org-wide memories (for hard limit check, exclude archived)
  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, org.id));

  let orgUsed = 0;
  if (orgProjects.length > 0) {
    const [orgCount] = await db
      .select({ value: count() })
      .from(memories)
      .where(
        and(
          inArray(
            memories.projectId,
            orgProjects.map((p) => p.id),
          ),
          isNull(memories.archivedAt),
        ),
      );
    orgUsed = orgCount?.value ?? 0;
  }

  // Count project-specific memories (for soft limit)
  let projectUsed = 0;
  if (projectId) {
    const [projectCount] = await db
      .select({ value: count() })
      .from(memories)
      .where(
        and(eq(memories.projectId, projectId), isNull(memories.archivedAt)),
      );
    projectUsed = projectCount?.value ?? 0;
  }

  // Hard-full: org-wide limit exceeded (actual block)
  const isHardFull = !isUnlimited(hardLimit) && orgUsed >= hardLimit;

  // Soft-full: project limit exceeded (warning, not blocking)
  const isSoftFull = !isUnlimited(softLimit) && projectUsed >= softLimit;

  // Approaching soft limit (>80%)
  const isApproaching =
    !isUnlimited(softLimit) && projectUsed >= softLimit * 0.8;

  return {
    used: projectId ? projectUsed : orgUsed,
    limit: projectId ? softLimit : hardLimit,
    orgUsed,
    orgLimit: hardLimit,
    // Only block on hard (org) limit
    isFull: isHardFull,
    isSoftFull,
    isApproaching,
    usageRatio:
      projectId && !isUnlimited(softLimit) && softLimit > 0
        ? Math.min(1, projectUsed / softLimit)
        : null,
  };
}
