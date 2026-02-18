import Link from "next/link";
import { db } from "@/lib/db";
import { blogPosts, users } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { EmptyState } from "@/components/dashboard/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import { DeletePostButton } from "./delete-button";

export const dynamic = "force-dynamic";

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
    <div>
      <PageHeader
        badge="Content"
        title="Blog Posts"
        description={`${posts.length} posts`}
      >
        <Link href="/admin/blog/new">
          <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </Link>
      </PageHeader>

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts yet"
          description="Create your first blog post."
        >
          <Link href="/admin/blog/new">
            <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="dash-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Title
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell">
                  Status
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] md:table-cell">
                  Author
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] lg:table-cell">
                  Updated
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow
                  key={post.id}
                  className="border-[var(--landing-border)]"
                >
                  <TableCell>
                    <span className="font-medium text-[var(--landing-text)]">
                      {post.title}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        post.status === "published"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {post.status === "published" ? "Published" : "Draft"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-[var(--landing-text-secondary)] md:table-cell">
                    {post.authorName}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-[var(--landing-text-tertiary)] lg:table-cell">
                    {post.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/blog/${post.slug}/edit`}
                        className="text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                      >
                        Edit
                      </Link>
                      <DeletePostButton slug={post.slug} title={post.title} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
