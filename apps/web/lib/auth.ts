import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";

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
