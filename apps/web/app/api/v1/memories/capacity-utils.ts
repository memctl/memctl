import { db } from "@/lib/db";
import { memories, organizations, projects } from "@memctl/db/schema";
import { PLAN_IDS, PLANS, type PlanId } from "@memctl/shared/constants";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export async function resolveOrgAndProject(
  orgSlug: string,
  projectSlug: string,
) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  if (!project) return null;
  return { org, project };
}

/**
 * Get memory capacity for a specific project.
 * Returns both project-level soft limit and org-level hard limit.
 *
 * - softLimit (per-project): agents get a warning when approaching this
 * - hardLimit (org-wide): actual storage block when reached
 */
export async function getOrgMemoryCapacity(orgId: string, rawPlanId: string, projectId?: string) {
  const planId = isPlanId(rawPlanId) ? rawPlanId : "free";
  const plan = PLANS[planId];
  const softLimit = plan.memoryLimitPerProject;
  const hardLimit = plan.memoryLimitOrg;

  // Count org-wide memories (for hard limit check, exclude archived)
  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  let orgUsed = 0;
  if (orgProjects.length > 0) {
    const [orgCount] = await db
      .select({ value: count() })
      .from(memories)
      .where(
        and(
          inArray(memories.projectId, orgProjects.map((p) => p.id)),
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
        and(
          eq(memories.projectId, projectId),
          isNull(memories.archivedAt),
        ),
      );
    projectUsed = projectCount?.value ?? 0;
  }

  // Hard-full: org-wide limit exceeded (actual block)
  const isHardFull = Number.isFinite(hardLimit) && orgUsed >= hardLimit;

  // Soft-full: project limit exceeded (warning, not blocking)
  const isSoftFull = Number.isFinite(softLimit) && projectUsed >= softLimit;

  // Approaching soft limit (>80%)
  const isApproaching = Number.isFinite(softLimit) && projectUsed >= softLimit * 0.8;

  return {
    used: projectId ? projectUsed : orgUsed,
    limit: projectId ? softLimit : hardLimit,
    orgUsed,
    orgLimit: hardLimit,
    // Only block on hard (org) limit
    isFull: isHardFull,
    isSoftFull,
    isApproaching,
    usageRatio: projectId && Number.isFinite(softLimit) && softLimit > 0
      ? Math.min(1, projectUsed / softLimit)
      : null,
  };
}
