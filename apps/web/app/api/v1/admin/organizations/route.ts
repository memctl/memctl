import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  projects,
  organizationMembers,
} from "@memctl/db/schema";
import { desc, asc, eq, like, or, and, count, type SQL } from "drizzle-orm";
import { getEffectivePlanId } from "@/lib/plans";

interface BaseOrgRow {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  planId: string;
  status: string;
  createdAt: Date;
  planOverride: string | null;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

interface EnrichedOrg {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  planId: string;
  effectivePlanId: string;
  status: string;
  createdAt: Date;
  ownerName: string;
  projectCount: number;
  memberCount: number;
}

function sortByRequestedField(
  orgs: EnrichedOrg[] | Array<BaseOrgRow & { effectivePlanId: string }>,
  sort: string,
  order: "asc" | "desc",
) {
  orgs.sort((a, b) => {
    if (sort === "name") {
      const diff = a.name.localeCompare(b.name);
      return order === "asc" ? diff : -diff;
    }
    if (sort === "projects" && "projectCount" in a && "projectCount" in b) {
      const diff = a.projectCount - b.projectCount;
      return order === "asc" ? diff : -diff;
    }
    if (sort === "members" && "memberCount" in a && "memberCount" in b) {
      const diff = a.memberCount - b.memberCount;
      return order === "asc" ? diff : -diff;
    }
    const diff = a.createdAt.getTime() - b.createdAt.getTime();
    return order === "asc" ? diff : -diff;
  });
}

async function enrichOrg(org: BaseOrgRow & { effectivePlanId: string }) {
  const [[owner], [projectCount], [memberCount]] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, org.ownerId)).limit(1),
    db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.orgId, org.id)),
    db
      .select({ value: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.orgId, org.id)),
  ]);

  return {
    ...org,
    ownerName: owner?.name ?? "Unknown",
    projectCount: projectCount?.value ?? 0,
    memberCount: memberCount?.value ?? 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl.searchParams;
  const search = url.get("search")?.trim() ?? "";
  const plan = url.get("plan") ?? "";
  const status = url.get("status") ?? "";
  const sort = url.get("sort") ?? "createdAt";
  const order = url.get("order") === "asc" ? "asc" : "desc";
  const limit = Math.min(parseInt(url.get("limit") ?? "25") || 25, 100);
  const offset = parseInt(url.get("offset") ?? "0") || 0;

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        like(organizations.name, `%${search}%`),
        like(organizations.slug, `%${search}%`),
      )!,
    );
  }

  if (status && status !== "all") {
    conditions.push(eq(organizations.status, status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const requestedPlan = plan && plan !== "all" ? plan : null;
  const isJsSort = sort === "projects" || sort === "members";
  const needsDerivedFiltering = Boolean(requestedPlan) || isJsSort;

  if (needsDerivedFiltering) {
    const allOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        ownerId: organizations.ownerId,
        planId: organizations.planId,
        status: organizations.status,
        createdAt: organizations.createdAt,
        planOverride: organizations.planOverride,
        trialEndsAt: organizations.trialEndsAt,
        planExpiresAt: organizations.planExpiresAt,
      })
      .from(organizations)
      .where(where);

    const withEffective = allOrgs
      .map((org) => ({
        ...org,
        effectivePlanId: getEffectivePlanId(org),
      }))
      .filter((org) =>
        requestedPlan ? org.effectivePlanId === requestedPlan : true,
      );

    if (isJsSort) {
      const enriched = await Promise.all(withEffective.map(enrichOrg));
      sortByRequestedField(enriched, sort, order);

      const paged = enriched.slice(offset, offset + limit);
      return NextResponse.json({
        organizations: paged.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          ownerId: o.ownerId,
          planId: o.planId,
          effectivePlanId: o.effectivePlanId,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          ownerName: o.ownerName,
          projectCount: o.projectCount,
          memberCount: o.memberCount,
        })),
        total: withEffective.length,
      });
    }

    sortByRequestedField(withEffective, sort, order);
    const paged = withEffective.slice(offset, offset + limit);
    const enriched = await Promise.all(paged.map(enrichOrg));

    return NextResponse.json({
      organizations: enriched.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        ownerId: o.ownerId,
        planId: o.planId,
        effectivePlanId: o.effectivePlanId,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        ownerName: o.ownerName,
        projectCount: o.projectCount,
        memberCount: o.memberCount,
      })),
      total: withEffective.length,
    });
  }

  const sortCol =
    sort === "name" ? organizations.name : organizations.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const [orgs, totalResult] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        ownerId: organizations.ownerId,
        planId: organizations.planId,
        status: organizations.status,
        createdAt: organizations.createdAt,
        planOverride: organizations.planOverride,
        trialEndsAt: organizations.trialEndsAt,
        planExpiresAt: organizations.planExpiresAt,
      })
      .from(organizations)
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(organizations).where(where),
  ]);

  const enriched = await Promise.all(
    orgs.map((org) =>
      enrichOrg({
        ...org,
        effectivePlanId: getEffectivePlanId(org),
      }),
    ),
  );

  return NextResponse.json({
    organizations: enriched.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      ownerId: o.ownerId,
      planId: o.planId,
      effectivePlanId: o.effectivePlanId,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      ownerName: o.ownerName,
      projectCount: o.projectCount,
      memberCount: o.memberCount,
    })),
    total: totalResult[0]?.value ?? 0,
  });
}
