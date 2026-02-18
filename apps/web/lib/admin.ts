import { auth, type Session } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function requireAdmin(): Promise<NonNullable<Session>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.isAdmin) {
    throw new Error("NOT_ADMIN");
  }

  return session;
}

export async function getOptionalAdmin(): Promise<{
  session: NonNullable<Session> | null;
  isAdmin: boolean;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { session: null, isAdmin: false };
  }

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return { session, isAdmin: !!user?.isAdmin };
}
