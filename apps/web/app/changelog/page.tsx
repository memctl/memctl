import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems, users } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Changelog | memctl",
  description: "See what's new in memctl. Version history, new features, improvements, and bug fixes.",
  openGraph: {
    title: "Changelog | memctl",
    description: "See what's new in memctl. Version history, new features, improvements, and bug fixes.",
    url: "/changelog",
  },
};

const categoryLabels: Record<string, string> = {
  feature: "Features",
  fix: "Fixes",
  improvement: "Improvements",
  breaking: "Breaking",
};

const categoryColors: Record<string, string> = {
  feature: "bg-orange-500/10 text-orange-500",
  fix: "bg-emerald-500/10 text-emerald-500",
  improvement: "bg-blue-500/10 text-blue-500",
  breaking: "bg-red-500/10 text-red-500",
};

export default async function ChangelogPage() {
  const entries = await db
    .select({
      id: changelogEntries.id,
      version: changelogEntries.version,
      title: changelogEntries.title,
      summary: changelogEntries.summary,
      releaseDate: changelogEntries.releaseDate,
      authorName: users.name,
    })
    .from(changelogEntries)
    .innerJoin(users, eq(changelogEntries.authorId, users.id))
    .where(eq(changelogEntries.status, "published"))
    .orderBy(desc(changelogEntries.releaseDate));

  // Fetch items for all entries
  const entryIds = entries.map((e) => e.id);
  let allItems: { entryId: string; category: string }[] = [];
  if (entryIds.length > 0) {
    const items = await db
      .select({ entryId: changelogItems.entryId, category: changelogItems.category })
      .from(changelogItems);
    allItems = items.filter((item) => entryIds.includes(item.entryId));
  }

  const entriesWithCounts = entries.map((entry) => {
    const items = allItems.filter((item) => item.entryId === entry.id);
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return { ...entry, categoryCounts: counts };
  });

  return (
    <BlogLayout>
      <div className="py-16 lg:py-24">
        {/* Header */}
        <ScrollReveal>
          <div className="mb-16">
            <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
              Changelog
            </span>
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1]">
              What&apos;s New
            </h1>
            <p className="mt-4 max-w-xl text-[var(--landing-text-secondary)]">
              Version history, new features, improvements, and bug fixes.
            </p>
          </div>
        </ScrollReveal>

        {/* Timeline */}
        {entriesWithCounts.length === 0 ? (
          <ScrollReveal>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--landing-border)] py-24 text-center">
              <span className="mb-2 font-mono text-sm text-[var(--landing-text-tertiary)]">
                No entries yet
              </span>
              <p className="text-sm text-[var(--landing-text-tertiary)]">
                Check back soon for updates.
              </p>
            </div>
          </ScrollReveal>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7.5rem] top-0 hidden h-full w-px bg-[var(--landing-border)] md:block" />

            <div className="space-y-8">
              {entriesWithCounts.map((entry, i) => (
                <ScrollReveal key={entry.id} delay={i * 80}>
                  <div className="relative flex flex-col gap-4 md:flex-row md:gap-8">
                    {/* Left: version + date */}
                    <div className="flex shrink-0 items-start gap-4 md:w-[7.5rem] md:flex-col md:items-end md:gap-1">
                      <span className="font-mono text-sm font-semibold text-[#F97316]">
                        v{entry.version}
                      </span>
                      <time
                        dateTime={entry.releaseDate.toISOString()}
                        className="text-xs text-[var(--landing-text-tertiary)]"
                      >
                        {entry.releaseDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </time>
                    </div>

                    {/* Timeline dot */}
                    <div className="absolute left-[7.25rem] top-1.5 hidden h-2.5 w-2.5 rounded-full border-2 border-[#F97316] bg-[var(--landing-bg)] md:block" />

                    {/* Right: card */}
                    <Link
                      href={`/changelog/${entry.version}`}
                      className="group flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 transition-all hover:border-[var(--landing-border-hover)] hover:shadow-lg md:ml-4"
                    >
                      <h2 className="mb-2 text-lg font-semibold leading-snug transition-colors group-hover:text-[#F97316]">
                        {entry.title}
                      </h2>
                      {entry.summary && (
                        <p className="mb-4 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
                          {entry.summary}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(entry.categoryCounts).map(([cat, n]) => (
                          <span
                            key={cat}
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[cat] ?? "bg-gray-500/10 text-gray-500"}`}
                          >
                            {n} {n === 1 ? categoryLabels[cat]?.replace(/s$/, "") : categoryLabels[cat]}
                          </span>
                        ))}
                      </div>
                    </Link>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </BlogLayout>
  );
}
