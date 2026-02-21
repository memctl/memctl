import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, organizationMembers, orgInvitations } from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { isSelfHosted } from "@/lib/plans";

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
    // In self-hosted mode, check for pending invitations instead of onboarding
    if (isSelfHosted()) {
      const pending = await db
        .select()
        .from(orgInvitations)
        .where(
          and(
            eq(orgInvitations.email, session.user.email.toLowerCase()),
            isNull(orgInvitations.acceptedAt),
          ),
        );

      // If there are pending invitations, auto-accept them now
      if (pending.length > 0) {
        for (const invite of pending) {
          try {
            await db.insert(organizationMembers).values({
              id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
              orgId: invite.orgId,
              userId: session.user.id,
              role: invite.role,
              createdAt: new Date(),
            });
            await db
              .update(orgInvitations)
              .set({ acceptedAt: new Date() })
              .where(eq(orgInvitations.id, invite.id));
          } catch {
            // Ignore duplicate membership
          }
        }

        // Now find the org to redirect to
        const [inviteOrg] = await db
          .select({ slug: organizations.slug })
          .from(organizations)
          .where(eq(organizations.id, pending[0].orgId))
          .limit(1);

        if (inviteOrg) {
          redirect(`/org/${inviteOrg.slug}`);
        }
      }

      // No memberships, no invitations → show waiting page
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-md text-center">
            <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F97316]/10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <h1 className="mb-2 font-mono text-lg font-semibold text-[var(--landing-text)]">
                Waiting for invitation
              </h1>
              <p className="text-sm text-[var(--landing-text-tertiary)]">
                You&apos;re signed in as <span className="text-[var(--landing-text-secondary)]">{session.user.email}</span>,
                but you haven&apos;t been invited to any organization yet.
              </p>
              <p className="mt-3 text-sm text-[var(--landing-text-tertiary)]">
                Ask your organization owner or admin to invite you by email.
              </p>
            </div>
          </div>
        </div>
      );
    }

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
