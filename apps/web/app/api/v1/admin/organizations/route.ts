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

  if (plan && plan !== "all") {
    conditions.push(eq(organizations.planId, plan));
  }

  if (status && status !== "all") {
    conditions.push(eq(organizations.status, status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const isJsSort = sort === "projects" || sort === "members";

  if (isJsSort) {
    const [allOrgs, totalResult] = await Promise.all([
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          ownerId: organizations.ownerId,
          planId: organizations.planId,
          status: organizations.status,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .where(where),
      db.select({ value: count() }).from(organizations).where(where),
    ]);

    const enriched = await Promise.all(
      allOrgs.map(async (org) => {
        const [[owner], [projectCount], [memberCount]] = await Promise.all([
          db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, org.ownerId))
            .limit(1),
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
      }),
    );

    enriched.sort((a, b) => {
      const key = sort === "projects" ? "projectCount" : "memberCount";
      const diff = a[key] - b[key];
      return order === "asc" ? diff : -diff;
    });

    const sliced = enriched.slice(offset, offset + limit);

    return NextResponse.json({
      organizations: sliced.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      })),
      total: totalResult[0]?.value ?? 0,
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
      })
      .from(organizations)
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(organizations).where(where),
  ]);

  const enriched = await Promise.all(
    orgs.map(async (org) => {
      const [[owner], [projectCount], [memberCount]] = await Promise.all([
        db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, org.ownerId))
          .limit(1),
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
    }),
  );

  return NextResponse.json({
    organizations: enriched.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
    })),
    total: totalResult[0]?.value ?? 0,
  });
}
