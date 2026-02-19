import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { blogPosts } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { PostEditor } from "../../post-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditPostPage({ params }: PageProps) {
  const { slug } = await params;

  const [post] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  if (!post) {
    notFound();
  }

  return (
    <div>
      <PageHeader badge="Blog" title="Edit Post" />
      <PostEditor
        mode="edit"
        initialData={{
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          content: post.content,
          coverImageUrl: post.coverImageUrl ?? "",
          status: post.status,
        }}
      />
    </div>
  );
}
