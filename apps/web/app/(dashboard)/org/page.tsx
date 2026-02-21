import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, organizationMembers, orgInvitations } from "@memctl/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
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
            gt(orgInvitations.expiresAt, new Date()),
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
          <div className="mx-auto max-w-sm">
            <div className="relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]">
              {/* Top glow accent */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/40 to-transparent" />
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#F97316]/5 to-transparent" />

              <div className="relative p-8 text-center">
                {/* Animated pulse ring */}
                <div className="relative mx-auto mb-5 h-16 w-16">
                  <div className="absolute inset-0 animate-ping rounded-full bg-[#F97316]/10" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-1 animate-ping rounded-full bg-[#F97316]/5" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316]/10 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                  </div>
                </div>

                <h1 className="mb-2 font-mono text-base font-semibold text-[var(--landing-text)]">
                  Waiting for invitation
                </h1>
                <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                  You haven&apos;t been invited to any organization yet.
                </p>
              </div>

              {/* Info section */}
              <div className="border-t border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
                <div className="divide-y divide-[var(--landing-border)]">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Signed in as</span>
                    <span className="font-mono text-[10px] font-medium text-[var(--landing-text-secondary)]">{session.user.email}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Status</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="font-mono text-[10px] font-medium text-amber-400">Pending</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Access</span>
                    <span className="font-mono text-[10px] font-medium text-[var(--landing-text-secondary)]">Invite-only</span>
                  </div>
                </div>
              </div>

              {/* Bottom help text */}
              <div className="border-t border-[var(--landing-border)] px-4 py-3">
                <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)] text-center">
                  Ask your organization owner or admin to invite <span className="text-[#F97316]">{session.user.email}</span> to get access.
                </p>
              </div>
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
