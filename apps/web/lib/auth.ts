import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "./db";
import { isValidAdminEmail, sendEmail } from "./email";
import { AdminMagicLinkEmail } from "@/emails/admin-magic-link";
import { WelcomeEmail } from "@/emails/welcome";
import { users } from "@memctl/db/schema";
import { eq } from "drizzle-orm";

let _auth: ReturnType<typeof betterAuth> | null = null;

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
    }),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        scope: ["user:email"],
      },
    },
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

            // Send welcome email (fire-and-forget)
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
    if (!_auth) _auth = createAuth();
    return (_auth as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Session = Awaited<
  ReturnType<ReturnType<typeof betterAuth>["api"]["getSession"]>
>;
