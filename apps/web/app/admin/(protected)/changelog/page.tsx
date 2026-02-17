import Link from "next/link";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems, users } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Plus } from "lucide-react";
import { DeleteEntryButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function AdminChangelogPage() {
  const entries = await db
    .select({
      id: changelogEntries.id,
      version: changelogEntries.version,
      title: changelogEntries.title,
      status: changelogEntries.status,
      releaseDate: changelogEntries.releaseDate,
      createdAt: changelogEntries.createdAt,
      updatedAt: changelogEntries.updatedAt,
      authorName: users.name,
    })
    .from(changelogEntries)
    .innerJoin(users, eq(changelogEntries.authorId, users.id))
    .orderBy(desc(changelogEntries.releaseDate));

  // Fetch item counts
  const allItems = await db
    .select({ entryId: changelogItems.entryId })
    .from(changelogItems);

  const itemCounts: Record<string, number> = {};
  for (const item of allItems) {
    itemCounts[item.entryId] = (itemCounts[item.entryId] || 0) + 1;
  }

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
                Changelog
              </h1>
            </div>
            <Link
              href="/admin/changelog/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              <Plus className="h-4 w-4" />
              New Entry
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--landing-border)] py-24 text-center">
              <span className="mb-2 font-mono text-sm text-[var(--landing-text-tertiary)]">
                No entries yet
              </span>
              <p className="mb-6 text-sm text-[var(--landing-text-tertiary)]">
                Create your first changelog entry.
              </p>
              <Link
                href="/admin/changelog/new"
                className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#FB923C]"
              >
                <Plus className="h-4 w-4" />
                New Entry
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--landing-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
                    <th className="px-6 py-3 font-medium text-[var(--landing-text-tertiary)]">Version</th>
                    <th className="hidden px-6 py-3 font-medium text-[var(--landing-text-tertiary)] sm:table-cell">Title</th>
                    <th className="hidden px-6 py-3 font-medium text-[var(--landing-text-tertiary)] md:table-cell">Status</th>
                    <th className="hidden px-6 py-3 font-medium text-[var(--landing-text-tertiary)] lg:table-cell">Release Date</th>
                    <th className="hidden px-6 py-3 font-medium text-[var(--landing-text-tertiary)] lg:table-cell">Changes</th>
                    <th className="px-6 py-3 text-right font-medium text-[var(--landing-text-tertiary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-[var(--landing-border)] bg-[var(--landing-surface)] transition-colors last:border-b-0 hover:bg-[var(--landing-surface-2)]"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold text-[#F97316]">
                          v{entry.version}
                        </span>
                      </td>
                      <td className="hidden px-6 py-4 sm:table-cell">
                        <span className="font-medium">{entry.title}</span>
                      </td>
                      <td className="hidden px-6 py-4 md:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            entry.status === "published"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {entry.status === "published" ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="hidden px-6 py-4 text-[var(--landing-text-tertiary)] lg:table-cell">
                        {entry.releaseDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="hidden px-6 py-4 text-[var(--landing-text-tertiary)] lg:table-cell">
                        {itemCounts[entry.id] || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/changelog/${entry.version}/edit`}
                            className="text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                          >
                            Edit
                          </Link>
                          <DeleteEntryButton version={entry.version} title={entry.title} />
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
