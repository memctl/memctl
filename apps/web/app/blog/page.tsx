import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { blogPosts, users } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | memctl",
  description: "News, updates, and engineering insights from the memctl team.",
  openGraph: {
    title: "Blog | memctl",
    description: "News, updates, and engineering insights from the memctl team.",
    url: "/blog",
  },
};

export default async function BlogPage() {
  const posts = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      coverImageUrl: blogPosts.coverImageUrl,
      publishedAt: blogPosts.publishedAt,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(blogPosts)
    .innerJoin(users, eq(blogPosts.authorId, users.id))
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt));

  return (
    <BlogLayout>
      <div className="py-16 lg:py-24">
        {/* Header */}
        <ScrollReveal>
          <div className="mb-16">
            <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
              FIG 01
            </span>
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1]">
              Blog
            </h1>
            <p className="mt-4 max-w-xl text-[var(--landing-text-secondary)]">
              News, updates, and engineering insights from the memctl team.
            </p>
          </div>
        </ScrollReveal>

        {/* Posts grid */}
        {posts.length === 0 ? (
          <ScrollReveal>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--landing-border)] py-24 text-center">
              <span className="mb-2 font-mono text-sm text-[var(--landing-text-tertiary)]">
                No posts yet
              </span>
              <p className="text-sm text-[var(--landing-text-tertiary)]">
                Check back soon for updates.
              </p>
            </div>
          </ScrollReveal>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <ScrollReveal key={post.slug} delay={i * 80}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] transition-all hover:border-[var(--landing-border-hover)] hover:shadow-lg"
                >
                  {post.coverImageUrl && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--landing-surface-2)]">
                      <img
                        src={post.coverImageUrl}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="mb-2 text-lg font-semibold leading-snug transition-colors group-hover:text-[#F97316]">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="mb-4 flex-1 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="mt-auto flex items-center gap-3 border-t border-[var(--landing-border)] pt-4">
                      {post.authorAvatar && (
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          className="h-6 w-6 rounded-full"
                        />
                      )}
                      <span className="text-xs font-medium text-[var(--landing-text-secondary)]">
                        {post.authorName}
                      </span>
                      {post.publishedAt && (
                        <>
                          <span className="text-[var(--landing-text-tertiary)]">&middot;</span>
                          <time
                            dateTime={post.publishedAt.toISOString()}
                            className="text-xs text-[var(--landing-text-tertiary)]"
                          >
                            {post.publishedAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </time>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </BlogLayout>
  );
}
