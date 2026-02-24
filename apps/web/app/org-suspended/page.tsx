import Link from "next/link";
import { db } from "@/lib/db";
import { organizations } from "@memctl/db/schema";
import { eq } from "drizzle-orm";

export default async function OrgSuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  let reason: string | null = null;
  if (slug) {
    const [org] = await db
      .select({ statusReason: organizations.statusReason })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    reason = org?.statusReason ?? null;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--landing-bg)]">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] opacity-[0.4] [mask-image:radial-gradient(ellipse_40%_40%_at_50%_50%,black_50%,transparent_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-[100px]"
        aria-hidden="true"
      />
      <div className="max-w-md px-4 text-center">
        <span className="mb-4 inline-block rounded-full bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-medium uppercase text-amber-500">
          Suspended
        </span>
        <h1 className="mb-2 text-2xl font-bold text-[var(--landing-text)]">
          Organization Suspended
        </h1>
        {reason && (
          <p className="mb-4 font-mono text-sm text-[var(--landing-text-secondary)]">
            {reason}
          </p>
        )}
        <p className="mb-6 text-sm text-[var(--landing-text-tertiary)]">
          This organization has been suspended by a platform administrator. If
          you believe this is an error, please contact support.
        </p>
        <Link
          href="/"
          className="border border-[var(--landing-border)] px-6 py-3 font-mono text-sm text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-surface-2)]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
