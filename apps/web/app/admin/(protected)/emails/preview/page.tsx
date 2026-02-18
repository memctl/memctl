import { render } from "@react-email/components";
import { AdminMagicLinkEmail } from "@/emails/admin-magic-link";
import { WelcomeEmail } from "@/emails/welcome";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const templates = [
  {
    name: "Admin Magic Link",
    slug: "admin-magic-link",
    description: "Sent when an admin requests a magic link login",
  },
  {
    name: "Welcome",
    slug: "welcome",
    description: "Sent to new users after sign-up",
  },
] as const;

async function getEmailHtml(slug: string): Promise<string> {
  switch (slug) {
    case "admin-magic-link":
      return await render(
        AdminMagicLinkEmail({
          url: `${APP_URL}/api/auth/magic-link/verify?token=preview-token-example`,
          email: "admin@memctl.com",
        }),
      );
    case "welcome":
      return await render(
        WelcomeEmail({
          name: "Jane Developer",
        }),
      );
    default:
      return "<p>Unknown template</p>";
  }
}

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  const selected = template ?? templates[0].slug;
  const html = await getEmailHtml(selected);

  return (
    <div className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]">
      <div className="border-b border-[var(--landing-border)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              <span className="text-[#F97316]">&#9656;</span> Email Previews
            </h1>
            <p className="text-xs text-[var(--landing-text-tertiary)]">
              Preview transactional email templates
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
          >
            &larr; Back to Admin
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-6">
        {/* Template list */}
        <div className="w-56 shrink-0">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Templates
          </p>
          <nav className="space-y-1">
            {templates.map((t) => (
              <Link
                key={t.slug}
                href={`?template=${t.slug}`}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  selected === t.slug
                    ? "bg-[#F97316]/10 text-[#F97316]"
                    : "text-[var(--landing-text-secondary)] hover:bg-[var(--landing-surface-2)]"
                }`}
              >
                {t.name}
                <span className="mt-0.5 block text-[11px] text-[var(--landing-text-tertiary)]">
                  {t.description}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Preview pane */}
        <div className="flex-1 overflow-hidden rounded-lg border border-[var(--landing-border)]">
          <div className="flex items-center justify-between border-b border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2">
            <span className="text-xs text-[var(--landing-text-tertiary)]">
              {templates.find((t) => t.slug === selected)?.name ?? "Preview"}
            </span>
            <span className="rounded bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              560px viewport
            </span>
          </div>
          <div className="flex justify-center bg-neutral-950 p-6">
            <iframe
              srcDoc={html}
              className="h-[700px] w-[560px] rounded border-0 bg-white"
              title="Email preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
