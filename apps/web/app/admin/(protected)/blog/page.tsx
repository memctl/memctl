import Link from "next/link";
import { db } from "@/lib/db";
import { blogPosts, users } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";

export const dynamic = "force-dynamic";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Plus } from "lucide-react";
import { DeletePostButton } from "./delete-button";

export default async function AdminBlogPage() {
  const posts = await db
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
    .orderBy(desc(blogPosts.updatedAt));

  return (
    <BlogLayout>
      <div className="py-16 lg:py-24">
        <ScrollReveal>
          <div className="mb-12 flex items-center justify-between">
            <div>
              <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
                Admin
              </span>
              <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1]">
                Blog Posts
              </h1>
            </div>
            <Link
              href="/admin/blog/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              <Plus className="h-4 w-4" />
              New Post
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--landing-border)] py-24 text-center">
              <span className="mb-2 font-mono text-sm text-[var(--landing-text-tertiary)]">
                No posts yet
              </span>
              <p className="mb-6 text-sm text-[var(--landing-text-tertiary)]">
                Create your first blog post.
              </p>
              <Link
                href="/admin/blog/new"
                className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#FB923C]"
              >
                <Plus className="h-4 w-4" />
                New Post
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--landing-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
                    <th className="px-6 py-3 font-medium text-[var(--landing-text-tertiary)]">Title</th>
                    <th className="hidden px-6 py-3 font-medium text-[var(--landing-text-tertiary)] sm:table-cell">Status</th>
                    <th className="hidden px-6 py-3 font-medium text-[var(--landing-text-tertiary)] md:table-cell">Author</th>
                    <th className="hidden px-6 py-3 font-medium text-[var(--landing-text-tertiary)] lg:table-cell">Updated</th>
                    <th className="px-6 py-3 text-right font-medium text-[var(--landing-text-tertiary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-b border-[var(--landing-border)] bg-[var(--landing-surface)] transition-colors last:border-b-0 hover:bg-[var(--landing-surface-2)]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{post.title}</span>
                          <span className="text-xs text-[var(--landing-text-tertiary)] sm:hidden">
                            {post.status === "published" ? "Published" : "Draft"}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 sm:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            post.status === "published"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {post.status === "published" ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="hidden px-6 py-4 text-[var(--landing-text-secondary)] md:table-cell">
                        {post.authorName}
                      </td>
                      <td className="hidden px-6 py-4 text-[var(--landing-text-tertiary)] lg:table-cell">
                        {post.updatedAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/blog/${post.slug}/edit`}
                            className="text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                          >
                            Edit
                          </Link>
                          <DeletePostButton slug={post.slug} title={post.title} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollReveal>
      </div>
    </BlogLayout>
  );
}
