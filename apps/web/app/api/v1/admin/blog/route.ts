import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { blogPosts, users } from "@memctl/db/schema";
import { eq, like, desc, asc, count, and, type SQL } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl.searchParams;
  const search = url.get("search")?.trim() ?? "";
  const status = url.get("status") ?? "";
  const sort = url.get("sort") ?? "updatedAt";
  const order = url.get("order") === "asc" ? "asc" : "desc";
  const limit = Math.min(parseInt(url.get("limit") ?? "20") || 20, 100);
  const offset = parseInt(url.get("offset") ?? "0") || 0;

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(like(blogPosts.title, `%${search}%`));
  }

  if (status && status !== "all") {
    conditions.push(eq(blogPosts.status, status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortCol =
    sort === "title"
      ? blogPosts.title
      : sort === "status"
        ? blogPosts.status
        : blogPosts.updatedAt;

  const orderFn = order === "asc" ? asc : desc;

  const [posts, totalResult] = await Promise.all([
    db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        status: blogPosts.status,
        publishedAt: blogPosts.publishedAt,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
        authorName: users.name,
      })
      .from(blogPosts)
      .innerJoin(users, eq(blogPosts.authorId, users.id))
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(blogPosts)
      .where(where),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    total: totalResult[0]?.value ?? 0,
  });
}
