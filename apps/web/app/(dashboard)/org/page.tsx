import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { eq } from "drizzle-orm";

/**
 * /org — redirects to the user's first org, or to onboarding if they have none.
 * This is the post-login landing page.
 */
export default async function OrgIndexPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Find user's org memberships
  const memberships = await db
    .select({ orgId: organizationMembers.orgId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id));

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  // Get the first org's slug
  const [org] = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, memberships[0].orgId))
    .limit(1);

  if (!org) {
    redirect("/onboarding");
  }

  redirect(`/org/${org.slug}`);
}
