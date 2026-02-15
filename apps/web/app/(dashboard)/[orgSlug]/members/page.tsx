import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  users,
} from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";

export default async function MembersPage({
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

  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember) redirect("/");

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const memberUsers = await Promise.all(
    members.map(async (m) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);
      return { ...m, user };
    }),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold">Members</h1>
          <p className="font-mono text-sm text-muted-foreground">
            {members.length} / {org.memberLimit} members
          </p>
        </div>
      </div>

      <div className="border border-border">
        {memberUsers.map((member, i) => (
          <div
            key={member.id}
            className={`flex items-center justify-between p-4 ${i < memberUsers.length - 1 ? "border-b border-border" : ""}`}
          >
            <div>
              <div className="font-mono text-sm font-bold">
                {member.user?.name ?? "Unknown"}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {member.user?.email}
              </div>
            </div>
            <Badge variant="outline">{member.role}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
