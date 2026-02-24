import { PageHeader } from "@/components/dashboard/shared/page-header";
import { BlogList } from "./blog-list";

export const dynamic = "force-dynamic";

export default function AdminBlogPage() {
  return (
    <div>
      <PageHeader badge="Content" title="Blog Posts" />
      <BlogList />
    </div>
  );
}
