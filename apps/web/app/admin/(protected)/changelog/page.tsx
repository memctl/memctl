import Link from "next/link";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems, users } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
import { Plus, History } from "lucide-react";
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
    <div>
      <PageHeader
        badge="Content"
        title="Changelog"
        description={`${entries.length} entries`}
      >
        <Link href="/admin/changelog/new">
          <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </Link>
      </PageHeader>

      {entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="No entries yet"
          description="Create your first changelog entry."
        >
          <Link href="/admin/changelog/new">
            <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="dash-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Version
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell">
                  Title
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] md:table-cell">
                  Status
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] lg:table-cell">
                  Release Date
                </TableHead>
                <TableHead className="hidden text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] lg:table-cell">
                  Changes
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="border-[var(--landing-border)]"
                >
                  <TableCell>
                    <span className="font-mono text-sm font-semibold text-[#F97316]">
                      v{entry.version}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm font-medium text-[var(--landing-text)] sm:table-cell">
                    {entry.title}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        entry.status === "published"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {entry.status === "published" ? "Published" : "Draft"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-[var(--landing-text-tertiary)] lg:table-cell">
                    {entry.releaseDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-xs text-[var(--landing-text-tertiary)] lg:table-cell">
                    {itemCounts[entry.id] || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/changelog/${entry.version}/edit`}
                        className="text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                      >
                        Edit
                      </Link>
                      <DeleteEntryButton
                        version={entry.version}
                        title={entry.title}
                      />
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
