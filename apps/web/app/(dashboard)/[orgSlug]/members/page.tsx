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
import { PageHeader } from "@/components/dashboard/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

const roleBadgeStyles: Record<string, string> = {
  owner:
    "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20",
  admin:
    "bg-blue-500/10 text-blue-500 border-blue-500/20",
  member:
    "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)] border-[var(--landing-border)]",
};

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
      <PageHeader
        badge="Team"
        title="Members"
        description={`${members.length} / ${org.memberLimit} members`}
      />

      <div className="dash-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Member
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Email
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Role
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Joined
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberUsers.map((member) => {
              const initials = member.user?.name
                ? member.user.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "?";
              return (
                <TableRow
                  key={member.id}
                  className="border-[var(--landing-border)]"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-[var(--landing-border)]">
                        {member.user?.avatarUrl && (
                          <AvatarImage
                            src={member.user.avatarUrl}
                            alt={member.user.name}
                          />
                        )}
                        <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-xs text-[var(--landing-text-secondary)]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono text-sm font-medium text-[var(--landing-text)]">
                        {member.user?.name ?? "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--landing-text-secondary)]">
                    {member.user?.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
                        roleBadgeStyles[member.role] ?? roleBadgeStyles.member
                      }`}
                    >
                      {member.role}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {member.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
