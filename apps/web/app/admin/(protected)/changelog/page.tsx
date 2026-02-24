import { PageHeader } from "@/components/dashboard/shared/page-header";
import { ChangelogList } from "./changelog-list";

export const dynamic = "force-dynamic";

export default function AdminChangelogPage() {
  return (
    <div>
      <PageHeader badge="Content" title="Changelog" />
      <ChangelogList />
    </div>
  );
}
