"use client";

import { BlogLayout } from "@/components/landing/blog-layout";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { PostEditor } from "../post-editor";

export default function NewPostPage() {
  return (
    <BlogLayout>
      <div className="py-16 lg:py-24">
        <ScrollReveal>
          <div className="mb-12">
            <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
              Admin
            </span>
            <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1]">
              New Post
            </h1>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <PostEditor mode="create" />
        </ScrollReveal>
      </div>
    </BlogLayout>
  );
}
