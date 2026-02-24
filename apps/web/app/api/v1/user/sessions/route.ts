import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessions } from "@memctl/db/schema";
import { eq, and, ne, gt } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, session.user.id),
        gt(sessions.expiresAt, new Date()),
      ),
    );

  return NextResponse.json({
    sessions: rows.map((s) => ({
      ...s,
      isCurrent: s.id === session.session.id,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    })),
  });
}

export async function DELETE(_req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, session.user.id),
        ne(sessions.id, session.session.id),
      ),
    );

  return NextResponse.json({
    result: { revoked: result.rowsAffected ?? 0 },
  });
}
