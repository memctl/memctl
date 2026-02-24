"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Shield,
  UserMinus,
  UserPlus,
  Crown,
  Users,
  Loader2,
} from "lucide-react";

interface MemberData {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  assignedToProject: boolean;
}

export interface ProjectMembersProps {
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  members: MemberData[];
  currentUserId: string;
}

const roleBadgeStyles: Record<string, string> = {
  owner: "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  member:
    "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)] border-[var(--landing-border)]",
};

export function ProjectMembers({
  orgSlug,
  projectSlug: _projectSlug,
  projectId,
  members: initialMembers,
  currentUserId,
}: ProjectMembersProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const assignedMembers = members.filter(
    (m) => m.assignedToProject || m.role === "owner" || m.role === "admin",
  );
  const unassignedMembers = members.filter(
    (m) => !m.assignedToProject && m.role === "member",
  );

  const ownerCount = assignedMembers.filter((m) => m.role === "owner").length;
  const adminCount = assignedMembers.filter((m) => m.role === "admin").length;
  const memberCount = assignedMembers.filter((m) => m.role === "member").length;

  const handleRoleChange = async (
    memberId: string,
    newRole: "admin" | "member",
  ) => {
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update role");
        return;
      }
      toast.success(`Role updated to ${newRole}`);
      router.refresh();
    } catch {
      toast.error("Network error");
    }
  };

  const handleRemoveFromProject = async (memberId: string, _userId: string) => {
    setSaving(memberId);
    try {
      const getRes = await fetch(
        `/api/v1/orgs/${orgSlug}/members/${memberId}/projects`,
      );
      if (!getRes.ok) {
        const data = await getRes.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to load assignments");
        return;
      }
      const { projectIds } = await getRes.json();
      const updated = (projectIds as string[]).filter(
        (id: string) => id !== projectId,
      );

      const res = await fetch(
        `/api/v1/orgs/${orgSlug}/members/${memberId}/projects`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: updated }),
        },
      );
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, assignedToProject: false } : m,
          ),
        );
        toast.success("Member removed from project");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update assignments");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(null);
    }
  };

  const handleAddToProject = async (memberId: string) => {
    setSaving(memberId);
    try {
      const getRes = await fetch(
        `/api/v1/orgs/${orgSlug}/members/${memberId}/projects`,
      );
      if (!getRes.ok) {
        const data = await getRes.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to load assignments");
        return;
      }
      const { projectIds } = await getRes.json();
      const updated = [...new Set([...(projectIds as string[]), projectId])];

      const res = await fetch(
        `/api/v1/orgs/${orgSlug}/members/${memberId}/projects`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: updated }),
        },
      );
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId ? { ...m, assignedToProject: true } : m,
          ),
        );
        toast.success("Member added to project");
        setAddDialogOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update assignments");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(null);
    }
  };

  const initials = (name?: string | null) =>
    name
      ? name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "?";

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          {
            icon: Crown,
            label: "Owners",
            value: ownerCount,
            color: "text-[#F97316]",
          },
          {
            icon: Shield,
            label: "Admins",
            value: adminCount,
            color: "text-blue-400",
          },
          {
            icon: Users,
            label: "Members",
            value: memberCount,
            color: "text-[var(--landing-text)]",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="dash-card glass-border relative overflow-hidden p-3"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/20 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                  {label}
                </p>
                <p className={`mt-1 font-mono text-lg font-bold ${color}`}>
                  {value}
                </p>
              </div>
              <div className="rounded-lg bg-[#F97316]/10 p-2">
                <Icon className="h-4 w-4 text-[#F97316]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Members with access */}
      <div className="dash-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-4 py-2.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Members with access
          </span>
          {unassignedMembers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="h-7 gap-1.5 px-2 font-mono text-[11px] text-[#F97316] hover:bg-[#F97316]/10 hover:text-[#F97316]"
            >
              <UserPlus className="h-3 w-3" />
              Add member
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Member
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Role
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell">
                  Joined
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedMembers.map((m) => {
                const isOwner = m.role === "owner";
                const isSelf = m.userId === currentUserId;
                const isRegularMember = m.role === "member";

                return (
                  <TableRow
                    key={m.id}
                    className="border-[var(--landing-border)]"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7 border border-[var(--landing-border)]">
                          {m.user?.avatarUrl && (
                            <AvatarImage
                              src={m.user.avatarUrl}
                              alt={m.user.name}
                            />
                          )}
                          <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-[10px] text-[var(--landing-text-secondary)]">
                            {initials(m.user?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-medium text-[var(--landing-text)]">
                            {m.user?.name ?? "Unknown"}
                          </p>
                          <p className="truncate font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                            {m.user?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
                          roleBadgeStyles[m.role] ?? roleBadgeStyles.member
                        }`}
                      >
                        {m.role}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[11px] text-[var(--landing-text-tertiary)] sm:table-cell">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {!isOwner && !isSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-7 w-7 p-0 text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 rounded-xl border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-lg"
                          >
                            <DropdownMenuItem
                              className="gap-2 rounded-lg text-sm text-[var(--landing-text-secondary)] hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
                              onClick={() =>
                                handleRoleChange(
                                  m.id,
                                  m.role === "admin" ? "member" : "admin",
                                )
                              }
                            >
                              <Shield className="h-4 w-4" />
                              {m.role === "admin"
                                ? "Demote to Member"
                                : "Promote to Admin"}
                            </DropdownMenuItem>
                            {isRegularMember && (
                              <>
                                <DropdownMenuSeparator className="bg-[var(--landing-border)]" />
                                <DropdownMenuItem
                                  className="gap-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-500"
                                  disabled={saving === m.id}
                                  onClick={() =>
                                    handleRemoveFromProject(m.id, m.userId)
                                  }
                                >
                                  <UserMinus className="h-4 w-4" />
                                  Remove from project
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add member dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="border-[var(--landing-border)] bg-[var(--landing-bg)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--landing-text)]">
              Add member to project
            </DialogTitle>
            <DialogDescription className="text-[var(--landing-text-tertiary)]">
              Grant a team member access to this project.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto py-2">
            {unassignedMembers.length === 0 ? (
              <p className="py-4 text-center font-mono text-xs text-[var(--landing-text-tertiary)]">
                All members already have access.
              </p>
            ) : (
              <div className="space-y-1">
                {unassignedMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--landing-surface-2)]"
                  >
                    <Avatar className="h-7 w-7 border border-[var(--landing-border)]">
                      {m.user?.avatarUrl && (
                        <AvatarImage src={m.user.avatarUrl} alt={m.user.name} />
                      )}
                      <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-[10px] text-[var(--landing-text-secondary)]">
                        {initials(m.user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-medium text-[var(--landing-text)]">
                        {m.user?.name ?? "Unknown"}
                      </p>
                      <p className="truncate font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                        {m.user?.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddToProject(m.id)}
                      disabled={saving === m.id}
                      className="h-7 gap-1 bg-[#F97316] px-2.5 font-mono text-[11px] text-white hover:bg-[#FB923C]"
                    >
                      {saving === m.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserPlus className="h-3 w-3" />
                      )}
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
