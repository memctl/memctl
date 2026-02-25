import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "./db";
import { isValidAdminEmail, sendEmail } from "./email";
import { AdminMagicLinkEmail } from "@/emails/admin-magic-link";
import { WelcomeEmail } from "@/emails/welcome";
import {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  organizationMembers,
  orgInvitations,
} from "@memctl/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getOrgCreationLimits, isSelfHosted } from "@/lib/plans";
import {
  ensureSeatForAdditionalMember,
  syncSeatQuantityToMemberCount,
} from "@/lib/seat-billing";

type AuthInstance = ReturnType<typeof betterAuth>;
type GetSessionArgs = Parameters<AuthInstance["api"]["getSession"]>[0];
type SessionResult = Awaited<ReturnType<AuthInstance["api"]["getSession"]>>;

let _auth: AuthInstance | null = null;
let _apiProxy: AuthInstance["api"] | null = null;
let _devBypassLogged = false;

export function getAuthInstance(): AuthInstance {
  if (!_auth) _auth = createAuth();
  return _auth;
}

function isDevAuthBypassEnabled() {
  const bypassRequested =
    process.env.DEV_AUTH_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

  // Allow bypass in development OR self-hosted mode
  return (
    bypassRequested &&
    (process.env.NODE_ENV === "development" || isSelfHosted())
  );
}

function getDevBypassConfig() {
  return {
    userId: process.env.DEV_AUTH_BYPASS_USER_ID ?? "dev-auth-user",
    userName: process.env.DEV_AUTH_BYPASS_USER_NAME ?? "Dev User",
    userEmail:
      process.env.DEV_AUTH_BYPASS_USER_EMAIL ?? "dev@local.memctl.test",
    orgId: process.env.DEV_AUTH_BYPASS_ORG_ID ?? "dev-auth-org",
    orgName: process.env.DEV_AUTH_BYPASS_ORG_NAME ?? "Dev Organization",
    orgSlug:
      process.env.DEV_AUTH_BYPASS_ORG_SLUG ??
      process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_ORG_SLUG ??
      "dev-org",
    asAdmin: process.env.DEV_AUTH_BYPASS_ADMIN === "true",
  };
}

async function ensureDevBypassSession(): Promise<SessionResult> {
  if (!isDevAuthBypassEnabled()) return null;

  const db = getDb();
  const config = getDevBypassConfig();
  const now = new Date();

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, config.userId))
    .limit(1);

  if (!user) {
    try {
      await db.insert(users).values({
        id: config.userId,
        name: config.userName,
        email: config.userEmail,
        isAdmin: config.asAdmin,
        onboardingCompleted: true,
      });
    } catch {
      // Ignore races/uniques and re-select below.
    }
  }

  [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, config.userId))
    .limit(1);

  if (!user) {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, config.userEmail))
      .limit(1);
  }

  if (!user) return null;

  if (!!user.isAdmin !== config.asAdmin) {
    await db
      .update(users)
      .set({ isAdmin: config.asAdmin })
      .where(eq(users.id, user.id));
  }

  let [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, config.orgSlug))
    .limit(1);

  const limits = getOrgCreationLimits();

  if (!org) {
    try {
      await db.insert(organizations).values({
        id: config.orgId,
        name: config.orgName,
        slug: config.orgSlug,
        ownerId: user.id,
        ...limits,
      });
    } catch {
      // Ignore races/uniques and re-select below.
    }

    [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, config.orgSlug))
      .limit(1);
  }

  if (!org) return null;

  // Auto-update limits if plan config changed (e.g. DEV_PLAN switched)
  if (
    org.planId !== limits.planId ||
    org.projectLimit !== limits.projectLimit ||
    org.memberLimit !== limits.memberLimit
  ) {
    await db
      .update(organizations)
      .set({ ...limits, updatedAt: new Date() })
      .where(eq(organizations.id, org.id));
  }

  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!membership) {
    try {
      await db.insert(organizationMembers).values({
        id: `dev-member-${org.id}-${user.id}`,
        orgId: org.id,
        userId: user.id,
        role: "owner",
      });
    } catch {
      // Ignore races/uniques.
    }
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.avatarUrl,
      createdAt: user.createdAt ?? now,
      updatedAt: user.updatedAt ?? now,
    },
    session: {
      id: "dev-auth-bypass-session",
      userId: user.id,
      token: "dev-auth-bypass-token",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "dev-auth-bypass",
      createdAt: now,
      updatedAt: now,
    },
  } as SessionResult;
}

async function getSessionWithDevBypass(
  args: GetSessionArgs,
): Promise<SessionResult> {
  const authInstance = getAuthInstance();

  const session = await authInstance.api.getSession(args);
  if (session || !isDevAuthBypassEnabled()) return session;

  const bypassSession = await ensureDevBypassSession();
  if (bypassSession && !_devBypassLogged) {
    const config = getDevBypassConfig();
    console.log(
      `[DEV AUTH BYPASS] Active as ${config.userEmail}. Open /org/${config.orgSlug}`,
    );
    _devBypassLogged = true;
  }

  return bypassSession;
}

function createAuth() {
  const configuredBaseUrl = (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");

  const baseURL = configuredBaseUrl || undefined;
  const trustedOrigins = baseURL ? [baseURL] : undefined;

  const githubClientId = process.env.GITHUB_CLIENT_ID?.trim();
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const socialProviders =
    githubClientId && githubClientSecret
      ? {
          github: {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
            scope: ["user:email"],
          },
        }
      : {};

  return betterAuth({
    ...(baseURL ? { baseURL } : {}),
    ...(trustedOrigins ? { trustedOrigins } : {}),
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      usePlural: true,
      schema: {
        users,
        sessions,
        accounts,
        verifications,
      },
    }),
    socialProviders,
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    plugins: [
      magicLink({
        expiresIn: 300,
        sendMagicLink: async ({ email, url }) => {
          const validation = isValidAdminEmail(email);
          if (!validation.valid) {
            throw new Error(validation.error);
          }

          if (
            process.env.NODE_ENV === "development" &&
            !process.env.RESEND_API_KEY
          ) {
            console.log("\n[DEV MAGIC LINK] ------------------------------");
            console.log(`   Email: ${email}`);
            console.log(`   URL:   ${url}`);
            console.log("-----------------------------------------------\n");
          }

          await sendEmail({
            to: email,
            subject: "Sign in to memctl Admin",
            react: AdminMagicLinkEmail({ url, email }),
          });
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const db = getDb();

            // Auto-promote @memctl.com users to admin
            if (user.email.endsWith("@memctl.com")) {
              await db
                .update(users)
                .set({ isAdmin: true })
                .where(eq(users.id, user.id));
            }

            // Accept pending non-expired org invitations
            const pendingInvites = await db
              .select()
              .from(orgInvitations)
              .where(
                and(
                  eq(orgInvitations.email, user.email.toLowerCase()),
                  isNull(orgInvitations.acceptedAt),
                  gt(orgInvitations.expiresAt, new Date()),
                ),
              );

            for (const invite of pendingInvites) {
              try {
                const seatResult = await ensureSeatForAdditionalMember(
                  invite.orgId,
                );
                if (!seatResult.ok) {
                  continue;
                }

                await db.insert(organizationMembers).values({
                  id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
                  orgId: invite.orgId,
                  userId: user.id,
                  role: invite.role,
                  createdAt: new Date(),
                });
                await db
                  .update(orgInvitations)
                  .set({ acceptedAt: new Date() })
                  .where(eq(orgInvitations.id, invite.id));
              } catch {
                try {
                  await syncSeatQuantityToMemberCount(invite.orgId);
                } catch {
                  // ignore seat sync failure
                }
                // Ignore duplicate membership races
              }
            }

            // Send welcome email (fire-and-forget; silently skipped in self-hosted)
            sendEmail({
              to: user.email,
              subject: "Welcome to memctl",
              react: WelcomeEmail({ name: user.name }),
            }).catch((err) => {
              console.error("Failed to send welcome email:", err);
            });
          },
        },
      },
    },
  });
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop) {
    const authInstance = getAuthInstance();
    if (prop === "api") {
      if (_apiProxy) return _apiProxy;

      _apiProxy = new Proxy(authInstance.api, {
        get(apiTarget, apiProp) {
          if (apiProp === "getSession") {
            return getSessionWithDevBypass;
          }
          return Reflect.get(apiTarget as object, apiProp);
        },
      });

      return _apiProxy;
    }
    return (authInstance as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Session = Awaited<
  ReturnType<ReturnType<typeof betterAuth>["api"]["getSession"]>
>;
