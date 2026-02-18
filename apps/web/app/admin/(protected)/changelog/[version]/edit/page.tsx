import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { EntryEditor } from "../../entry-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ version: string }>;
}

export default async function EditChangelogEntryPage({ params }: PageProps) {
  const { version } = await params;

  const [entry] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.version, version))
    .limit(1);

  if (!entry) {
    notFound();
  }

  const items = await db
    .select()
    .from(changelogItems)
    .where(eq(changelogItems.entryId, entry.id));

  const sortedItems = items.sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <PageHeader badge="Changelog" title={`Edit v${entry.version}`} />
      <EntryEditor
        mode="edit"
        initialData={{
          version: entry.version,
          title: entry.title,
          summary: entry.summary ?? "",
          releaseDate: entry.releaseDate.toISOString().split("T")[0],
          status: entry.status,
          items: sortedItems.map((i) => ({
            category: i.category,
            description: i.description,
            sortOrder: i.sortOrder,
          })),
        }}
      />
    </div>
  );
}
