import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  apiTokens,
  organizations,
  organizationMembers,
} from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { apiTokenCreateSchema } from "@memctl/shared/validators";
import { headers } from "next/headers";

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orgSlug = req.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "org is required" }, { status: 400 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const tokens = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.orgId, org.id),
        eq(apiTokens.userId, session.user.id),
        isNull(apiTokens.revokedAt),
      ),
    );

  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orgSlug = req.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "org is required" }, { status: 400 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify membership
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

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = apiTokenCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Generate raw token
  const rawToken = `mctl_${generateId()}${generateId()}`;
  const hashed = await hashToken(rawToken);

  const tokenId = generateId();
  const now = new Date();

  await db.insert(apiTokens).values({
    id: tokenId,
    userId: session.user.id,
    orgId: org.id,
    name: parsed.data.name,
    tokenHash: hashed,
    expiresAt: parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : null,
    createdAt: now,
  });

  return NextResponse.json(
    {
      token: rawToken,
      id: tokenId,
      name: parsed.data.name,
    },
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tokenId = req.nextUrl.searchParams.get("id");
  if (!tokenId) {
    return NextResponse.json({ error: "Token ID required" }, { status: 400 });
  }

  const [token] = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.id, tokenId),
        eq(apiTokens.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(eq(apiTokens.id, tokenId));

  return NextResponse.json({ revoked: true });
}
