import { db } from "@/lib/db";
import { memories, organizations, projects } from "@memctl/db/schema";
import { PLAN_IDS, PLANS, type PlanId } from "@memctl/shared/constants";
import { and, count, eq, inArray } from "drizzle-orm";

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

export async function getOrgMemoryCapacity(orgId: string, rawPlanId: string) {
  const planId = isPlanId(rawPlanId) ? rawPlanId : "free";
  const limit = PLANS[planId].memoryLimit;

  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  if (orgProjects.length === 0) {
    return {
      used: 0,
      limit,
      isFull: Number.isFinite(limit) && 0 >= limit,
    };
  }

  const [memoryCount] = await db
    .select({ value: count() })
    .from(memories)
    .where(inArray(memories.projectId, orgProjects.map((p) => p.id)));

  const used = memoryCount?.value ?? 0;
  const isFull = Number.isFinite(limit) && used >= limit;

  return { used, limit, isFull };
}
