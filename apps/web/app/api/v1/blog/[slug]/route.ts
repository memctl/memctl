import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blogPosts, users } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, getOptionalAdmin } from "@/lib/admin";
import { z } from "zod";

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().min(1).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [post] = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      content: blogPosts.content,
      coverImageUrl: blogPosts.coverImageUrl,
      status: blogPosts.status,
      publishedAt: blogPosts.publishedAt,
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
      authorId: blogPosts.authorId,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(blogPosts)
    .innerJoin(users, eq(blogPosts.authorId, users.id))
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.status !== "published") {
    const { isAdmin } = await getOptionalAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ post });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const [existing] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  // Set publishedAt when first publishing
  if (parsed.data.status === "published" && !existing.publishedAt) {
    updates.publishedAt = new Date();
  }

  // Check new slug uniqueness if slug is being changed
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const [slugConflict] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, parsed.data.slug))
      .limit(1);

    if (slugConflict) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
  }

  await db
    .update(blogPosts)
    .set(updates)
    .where(eq(blogPosts.id, existing.id));

  const [updated] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.id, existing.id))
    .limit(1);

  return NextResponse.json({ post: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const [existing] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await db.delete(blogPosts).where(eq(blogPosts.id, existing.id));

  return NextResponse.json({ success: true });
}
