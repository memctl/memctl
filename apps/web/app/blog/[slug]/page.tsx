import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { blogPosts, users } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { ArrowLeft } from "lucide-react";
import { BlogContent } from "./blog-content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
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
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(blogPosts)
    .innerJoin(users, eq(blogPosts.authorId, users.id))
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  return post;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post || post.status !== "published") {
    return { title: "Post Not Found | memctl" };
  }

  return {
    title: `${post.title} | memctl Blog`,
    description: post.excerpt ?? `Read "${post.title}" on the memctl blog.`,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      url: `/blog/${post.slug}`,
      type: "article",
      ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}),
      ...(post.publishedAt
        ? { publishedTime: post.publishedAt.toISOString() }
        : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post || post.status !== "published") {
    notFound();
  }

  return (
    <BlogLayout>
      <article className="py-16 lg:py-24">
        {/* Back link */}
        <ScrollReveal>
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to blog
          </Link>
        </ScrollReveal>

        {/* Article header */}
        <ScrollReveal>
          <header className="mx-auto mb-12 max-w-3xl">
            <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
              Blog
            </span>
            <h1 className="mb-6 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.15]">
              {post.title}
            </h1>
            <div className="flex items-center gap-3">
              {post.authorAvatar && (
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  className="h-8 w-8 rounded-full"
                />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{post.authorName}</span>
                {post.publishedAt && (
                  <time
                    dateTime={post.publishedAt.toISOString()}
                    className="text-xs text-[var(--landing-text-tertiary)]"
                  >
                    {post.publishedAt.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                )}
              </div>
            </div>
          </header>
        </ScrollReveal>

        {/* Cover image */}
        {post.coverImageUrl && (
          <ScrollReveal>
            <div className="mx-auto mb-12 max-w-4xl overflow-hidden rounded-xl border border-[var(--landing-border)]">
              <img
                src={post.coverImageUrl}
                alt={post.title}
                className="w-full object-cover"
              />
            </div>
          </ScrollReveal>
        )}

        {/* Content */}
        <ScrollReveal>
          <div className="mx-auto max-w-3xl">
            <BlogContent content={post.content} />
          </div>
        </ScrollReveal>

        {/* Back to blog */}
        <ScrollReveal>
          <div className="mx-auto mt-16 max-w-3xl border-t border-[var(--landing-border)] pt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to blog
            </Link>
          </div>
        </ScrollReveal>
      </article>
    </BlogLayout>
  );
}
