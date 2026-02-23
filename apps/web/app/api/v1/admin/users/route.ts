import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { users, organizationMembers } from "@memctl/db/schema";
import {
  desc,
  asc,
  eq,
  like,
  or,
  and,
  count,
  inArray,
  notInArray,
  type SQL,
} from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl.searchParams;
  const search = url.get("search")?.trim() ?? "";
  const admin = url.get("admin") ?? "";
  const hasOrgs = url.get("hasOrgs") ?? "";
  const sort = url.get("sort") ?? "createdAt";
  const order = url.get("order") === "asc" ? "asc" : "desc";
  const limit = Math.min(parseInt(url.get("limit") ?? "25") || 25, 100);
  const offset = parseInt(url.get("offset") ?? "0") || 0;

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        like(users.name, `%${search}%`),
        like(users.email, `%${search}%`),
      )!,
    );
  }

  if (admin === "yes") {
    conditions.push(eq(users.isAdmin, true));
  } else if (admin === "no") {
    conditions.push(eq(users.isAdmin, false));
  }

  if (hasOrgs === "yes" || hasOrgs === "no") {
    const memberUserIds = await db
      .selectDistinct({ userId: organizationMembers.userId })
      .from(organizationMembers);
    const ids = memberUserIds.map((r) => r.userId);

    if (ids.length > 0) {
      if (hasOrgs === "yes") {
        conditions.push(inArray(users.id, ids));
      } else {
        conditions.push(notInArray(users.id, ids));
      }
    } else if (hasOrgs === "yes") {
      conditions.push(eq(users.id, "__impossible__"));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const isJsSort = sort === "orgs";

  if (isJsSort) {
    const [allUsers, totalResult] = await Promise.all([
      db.select().from(users).where(where),
      db.select({ value: count() }).from(users).where(where),
    ]);

    const orgCounts = await Promise.all(
      allUsers.map(async (user) => {
        const [result] = await db
          .select({ value: count() })
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, user.id));
        return { userId: user.id, count: result?.value ?? 0 };
      }),
    );

    const countsMap: Record<string, number> = {};
    for (const row of orgCounts) {
      countsMap[row.userId] = row.count;
    }

    const enriched = allUsers.map((u) => ({
      ...u,
      orgCount: countsMap[u.id] ?? 0,
    }));

    enriched.sort((a, b) => {
      const diff = a.orgCount - b.orgCount;
      return order === "asc" ? diff : -diff;
    });

    const sliced = enriched.slice(offset, offset + limit);

    return NextResponse.json({
      users: sliced.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
      total: totalResult[0]?.value ?? 0,
    });
  }

  const sortCol =
    sort === "name"
      ? users.name
      : sort === "email"
        ? users.email
        : users.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const [allUsers, totalResult] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(users).where(where),
  ]);

  const enriched = await Promise.all(
    allUsers.map(async (user) => {
      const [result] = await db
        .select({ value: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, user.id));
      return {
        ...user,
        orgCount: result?.value ?? 0,
      };
    }),
  );

  return NextResponse.json({
    users: enriched.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    })),
    total: totalResult[0]?.value ?? 0,
  });
}
