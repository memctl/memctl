import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { OrgSettingsForm } from "@/components/dashboard/org-settings-form";
import { PageHeader } from "@/components/dashboard/shared/page-header";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const { orgSlug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) redirect("/");

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member || member.role === "member") redirect(`/org/${orgSlug}`);

  return (
    <div className="max-w-2xl">
      <PageHeader badge="Settings" title="Organization Settings" />
      <OrgSettingsForm
        orgSlug={orgSlug}
        initialName={org.name}
        initialCompanyName={org.companyName ?? ""}
        initialTaxId={org.taxId ?? ""}
      />
    </div>
  );
}
