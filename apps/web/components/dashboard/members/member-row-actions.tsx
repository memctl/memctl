"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ProjectAssignmentDialog } from "./project-assignment-dialog";
import { MoreHorizontal, Shield, FolderOpen, UserMinus } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  projectIds: string[];
}

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface MemberRowActionsProps {
  member: Member;
  currentUserId: string;
  orgSlug: string;
  projects: Project[];
}

export function MemberRowActions({
  member,
  currentUserId,
  orgSlug,
  projects,
}: MemberRowActionsProps) {
  const router = useRouter();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [assignedProjectIds, setAssignedProjectIds] = useState(
    member.projectIds,
  );

  const isOwner = member.role === "owner";
  const isSelf = member.userId === currentUserId;

  const handleRoleChange = async (newRole: "admin" | "member") => {
    const res = await fetch(`/api/v1/orgs/${orgSlug}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role: newRole }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to update role");
      return;
    }
    router.refresh();
  };

  const handleRemove = async () => {
    if (
      !confirm(
        `Remove ${member.user?.name ?? "this member"} from the organization?`,
      )
    ) {
      return;
    }

    const res = await fetch(`/api/v1/orgs/${orgSlug}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to remove member");
      return;
    }
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-xl border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-lg"
        >
          {!isOwner && !isSelf && (
            <>
              <DropdownMenuItem
                className="gap-2 rounded-lg text-sm text-[var(--landing-text-secondary)] hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
                onClick={() =>
                  handleRoleChange(
                    member.role === "admin" ? "member" : "admin",
                  )
                }
              >
                <Shield className="h-4 w-4" />
                {member.role === "admin"
                  ? "Demote to Member"
                  : "Promote to Admin"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--landing-border)]" />
            </>
          )}
          <DropdownMenuItem
            className="gap-2 rounded-lg text-sm text-[var(--landing-text-secondary)] hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
            onClick={() => setProjectDialogOpen(true)}
          >
            <FolderOpen className="h-4 w-4" />
            Manage Projects
          </DropdownMenuItem>
          {!isOwner && !isSelf && (
            <>
              <DropdownMenuSeparator className="bg-[var(--landing-border)]" />
              <DropdownMenuItem
                className="gap-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-500"
                onClick={handleRemove}
              >
                <UserMinus className="h-4 w-4" />
                Remove Member
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectAssignmentDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        memberName={member.user?.name ?? "Unknown"}
        memberId={member.id}
        orgSlug={orgSlug}
        projects={projects}
        assignedProjectIds={assignedProjectIds}
        onSave={(ids) => {
          setAssignedProjectIds(ids);
          router.refresh();
        }}
      />
    </>
  );
}
