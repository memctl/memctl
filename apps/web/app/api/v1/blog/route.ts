import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blogPosts, users } from "@memctl/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { generateId, slugify } from "@/lib/utils";
import { requireAdmin, getOptionalAdmin } from "@/lib/admin";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
  );
  const offset = (page - 1) * limit;

  const { isAdmin } = await getOptionalAdmin();
  const showAll = isAdmin && statusFilter === "all";

  const conditions = showAll ? undefined : eq(blogPosts.status, "published");

  const posts = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      coverImageUrl: blogPosts.coverImageUrl,
      status: blogPosts.status,
      publishedAt: blogPosts.publishedAt,
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(blogPosts)
    .innerJoin(users, eq(blogPosts.authorId, users.id))
    .where(conditions)
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(blogPosts)
    .where(conditions);

  return NextResponse.json({
    posts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { title, excerpt, content, coverImageUrl, status } = parsed.data;
  const slug = parsed.data.slug || slugify(title);

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  }

  const now = new Date();
  const id = generateId();

  await db.insert(blogPosts).values({
    id,
    slug,
    title,
    excerpt: excerpt ?? null,
    content,
    coverImageUrl: coverImageUrl ?? null,
    authorId: session.user.id,
    status,
    publishedAt: status === "published" ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  const [post] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, id))
    .limit(1);

  return NextResponse.json({ post }, { status: 201 });
}
