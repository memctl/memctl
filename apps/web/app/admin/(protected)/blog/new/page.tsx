"use client";

import { PageHeader } from "@/components/dashboard/shared/page-header";
import { PostEditor } from "../post-editor";

export default function NewPostPage() {
  return (
    <div>
      <PageHeader badge="Blog" title="New Post" />
      <PostEditor mode="create" />
    </div>
  );
}
