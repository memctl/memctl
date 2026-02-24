import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems, users } from "@memctl/db/schema";
import { eq, like, or, desc, asc, count, and, type SQL } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl.searchParams;
  const search = url.get("search")?.trim() ?? "";
  const status = url.get("status") ?? "";
  const sort = url.get("sort") ?? "releaseDate";
  const order = url.get("order") === "asc" ? "asc" : "desc";
  const limit = Math.min(parseInt(url.get("limit") ?? "20") || 20, 100);
  const offset = parseInt(url.get("offset") ?? "0") || 0;

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(
      or(
        like(changelogEntries.version, `%${search}%`),
        like(changelogEntries.title, `%${search}%`),
      )!,
    );
  }

  if (status && status !== "all") {
    conditions.push(eq(changelogEntries.status, status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const isJsSort = sort === "changes";

  if (isJsSort) {
    const [allEntries, totalResult] = await Promise.all([
      db
        .select({
          id: changelogEntries.id,
          version: changelogEntries.version,
          title: changelogEntries.title,
          status: changelogEntries.status,
          releaseDate: changelogEntries.releaseDate,
          createdAt: changelogEntries.createdAt,
          updatedAt: changelogEntries.updatedAt,
          authorName: users.name,
        })
        .from(changelogEntries)
        .innerJoin(users, eq(changelogEntries.authorId, users.id))
        .where(where),
      db.select({ value: count() }).from(changelogEntries).where(where),
    ]);

    const itemCounts = await db
      .select({
        entryId: changelogItems.entryId,
        count: count(),
      })
      .from(changelogItems)
      .groupBy(changelogItems.entryId);

    const countsMap: Record<string, number> = {};
    for (const row of itemCounts) {
      countsMap[row.entryId] = row.count;
    }

    const withCounts = allEntries.map((e) => ({
      ...e,
      itemCount: countsMap[e.id] ?? 0,
    }));

    withCounts.sort((a, b) => {
      const diff = a.itemCount - b.itemCount;
      return order === "asc" ? diff : -diff;
    });

    const sliced = withCounts.slice(offset, offset + limit);

    return NextResponse.json({
      entries: sliced.map((e) => ({
        ...e,
        releaseDate: e.releaseDate.toISOString(),
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      total: totalResult[0]?.value ?? 0,
    });
  }

  const sortCol =
    sort === "version"
      ? changelogEntries.version
      : changelogEntries.releaseDate;

  const orderFn = order === "asc" ? asc : desc;

  const [entries, totalResult] = await Promise.all([
    db
      .select({
        id: changelogEntries.id,
        version: changelogEntries.version,
        title: changelogEntries.title,
        status: changelogEntries.status,
        releaseDate: changelogEntries.releaseDate,
        createdAt: changelogEntries.createdAt,
        updatedAt: changelogEntries.updatedAt,
        authorName: users.name,
      })
      .from(changelogEntries)
      .innerJoin(users, eq(changelogEntries.authorId, users.id))
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(changelogEntries).where(where),
  ]);

  const entryIds = entries.map((e) => e.id);
  const countsMap: Record<string, number> = {};

  if (entryIds.length > 0) {
    const itemCounts = await db
      .select({
        entryId: changelogItems.entryId,
        count: count(),
      })
      .from(changelogItems)
      .groupBy(changelogItems.entryId);

    for (const row of itemCounts) {
      if (entryIds.includes(row.entryId)) {
        countsMap[row.entryId] = row.count;
      }
    }
  }

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      itemCount: countsMap[e.id] ?? 0,
      releaseDate: e.releaseDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    total: totalResult[0]?.value ?? 0,
  });
}
