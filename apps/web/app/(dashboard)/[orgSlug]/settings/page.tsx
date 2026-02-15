import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { OrgSettingsForm } from "@/components/dashboard/org-settings-form";

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

  if (!member || member.role === "member") redirect(`/${orgSlug}`);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-mono text-2xl font-bold">Organization Settings</h1>
      <OrgSettingsForm
        orgSlug={orgSlug}
        initialName={org.name}
        initialCompanyName={org.companyName ?? ""}
        initialTaxId={org.taxId ?? ""}
      />
    </div>
  );
}
