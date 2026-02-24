import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems, users } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { BlogLayout } from "@/components/landing/blog-layout";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { ArrowLeft } from "lucide-react";
import { ChangelogItemContent } from "./changelog-item-content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ version: string }>;
}

const categoryLabels: Record<string, string> = {
  feature: "Features",
  fix: "Bug Fixes",
  improvement: "Improvements",
  breaking: "Breaking Changes",
};

const categoryColors: Record<string, string> = {
  feature: "bg-orange-500/10 text-orange-500",
  fix: "bg-emerald-500/10 text-emerald-500",
  improvement: "bg-blue-500/10 text-blue-500",
  breaking: "bg-red-500/10 text-red-500",
};

const categoryOrder = ["breaking", "feature", "improvement", "fix"];

async function getEntry(version: string) {
  const [entry] = await db
    .select({
      id: changelogEntries.id,
      version: changelogEntries.version,
      title: changelogEntries.title,
      summary: changelogEntries.summary,
      releaseDate: changelogEntries.releaseDate,
      status: changelogEntries.status,
      createdAt: changelogEntries.createdAt,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(changelogEntries)
    .innerJoin(users, eq(changelogEntries.authorId, users.id))
    .where(eq(changelogEntries.version, version))
    .limit(1);

  return entry;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { version } = await params;
  const entry = await getEntry(version);

  if (!entry || entry.status !== "published") {
    return { title: "Version Not Found | memctl" };
  }

  return {
    title: `v${entry.version} — ${entry.title} | memctl Changelog`,
    description: entry.summary ?? `See what's new in memctl v${entry.version}.`,
    openGraph: {
      title: `v${entry.version} — ${entry.title}`,
      description: entry.summary ?? undefined,
      url: `/changelog/${entry.version}`,
    },
  };
}

export default async function ChangelogVersionPage({ params }: PageProps) {
  const { version } = await params;
  const entry = await getEntry(version);

  if (!entry || entry.status !== "published") {
    notFound();
  }

  const items = await db
    .select()
    .from(changelogItems)
    .where(eq(changelogItems.entryId, entry.id));

  // Group items by category
  const grouped: Record<string, typeof items> = {};
  for (const item of items.sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  }

  // Sort categories by defined order
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) =>
      (categoryOrder.indexOf(a) ?? 99) - (categoryOrder.indexOf(b) ?? 99),
  );

  return (
    <BlogLayout>
      <article className="py-16 lg:py-24">
        {/* Back link */}
        <ScrollReveal>
          <Link
            href="/changelog"
            className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to changelog
          </Link>
        </ScrollReveal>

        {/* Header */}
        <ScrollReveal>
          <header className="mx-auto mb-12 max-w-3xl">
            <span className="mb-4 inline-block rounded-full bg-orange-500/10 px-3 py-1 font-mono text-sm font-semibold text-[#F97316]">
              v{entry.version}
            </span>
            <h1 className="mb-4 text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.15]">
              {entry.title}
            </h1>
            {entry.summary && (
              <p className="mb-6 text-lg text-[var(--landing-text-secondary)]">
                {entry.summary}
              </p>
            )}
            <div className="flex items-center gap-3">
              {entry.authorAvatar && (
                <img
                  src={entry.authorAvatar}
                  alt={entry.authorName}
                  className="h-8 w-8 rounded-full"
                />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{entry.authorName}</span>
                <time
                  dateTime={entry.releaseDate.toISOString()}
                  className="text-xs text-[var(--landing-text-tertiary)]"
                >
                  {entry.releaseDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
            </div>
          </header>
        </ScrollReveal>

        {/* Changes grouped by category */}
        <div className="mx-auto max-w-3xl space-y-10">
          {sortedCategories.map((category, i) => (
            <ScrollReveal key={category} delay={i * 60}>
              <section>
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[category] ?? "bg-gray-500/10 text-gray-500"}`}
                  >
                    {categoryLabels[category] ?? category}
                  </span>
                  <div className="h-px flex-1 bg-[var(--landing-border)]" />
                </div>
                <ul className="space-y-4">
                  {grouped[category].map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4"
                    >
                      <ChangelogItemContent content={item.description} />
                    </li>
                  ))}
                </ul>
              </section>
            </ScrollReveal>
          ))}
        </div>

        {/* Back to changelog */}
        <ScrollReveal>
          <div className="mx-auto mt-16 max-w-3xl border-t border-[var(--landing-border)] pt-8">
            <Link
              href="/changelog"
              className="inline-flex items-center gap-2 text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to changelog
            </Link>
          </div>
        </ScrollReveal>
      </article>
    </BlogLayout>
  );
}
