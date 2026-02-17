import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
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
    <BlogLayout>
      <div className="py-16 lg:py-24">
        <ScrollReveal>
          <div className="mb-12">
            <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
              Admin
            </span>
            <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1]">
              Edit v{entry.version}
            </h1>
          </div>
        </ScrollReveal>

        <ScrollReveal>
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
        </ScrollReveal>
      </div>
    </BlogLayout>
  );
}
