import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { blogPosts } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";

export const dynamic = "force-dynamic";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { PostEditor } from "../../post-editor";

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
    <BlogLayout>
      <div className="py-16 lg:py-24">
        <ScrollReveal>
          <div className="mb-12">
            <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
              Admin
            </span>
            <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1]">
              Edit Post
            </h1>
          </div>
        </ScrollReveal>

        <ScrollReveal>
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
        </ScrollReveal>
      </div>
    </BlogLayout>
  );
}
