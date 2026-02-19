import { render } from "@react-email/components";
import { AdminMagicLinkEmail } from "@/emails/admin-magic-link";
import { WelcomeEmail } from "@/emails/welcome";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { SectionLabel } from "@/components/dashboard/shared/section-label";

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
    <div>
      <PageHeader
        badge="Emails"
        title="Email Previews"
        description="Preview transactional email templates"
      />

      <div className="flex gap-6">
        {/* Template list */}
        <div className="w-56 shrink-0">
          <SectionLabel>Templates</SectionLabel>
          <nav className="mt-3 space-y-1">
            {templates.map((t) => (
              <Link
                key={t.slug}
                href={`?template=${t.slug}`}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
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
        <div className="dash-card flex-1 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-4 py-2">
            <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
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
