"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface ProjectAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberId: string;
  orgSlug: string;
  projects: Project[];
  assignedProjectIds: string[];
  onSave: (projectIds: string[]) => void;
}

export function ProjectAssignmentDialog({
  open,
  onOpenChange,
  memberName,
  memberId,
  orgSlug,
  projects,
  assignedProjectIds,
  onSave,
}: ProjectAssignmentDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(assignedProjectIds),
  );
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/orgs/${orgSlug}/members/${memberId}/projects`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: Array.from(selected) }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update assignments");
        return;
      }
      toast.success("Project assignments updated");
      onSave(Array.from(selected));
      onOpenChange(false);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--landing-border)] bg-[var(--landing-surface)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--landing-text)]">
            Manage Project Access
          </DialogTitle>
          <DialogDescription className="text-[var(--landing-text-secondary)]">
            Select which projects{" "}
            <span className="font-medium text-[var(--landing-text)]">
              {memberName}
            </span>{" "}
            can access.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto py-2">
          {projects.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--landing-text-tertiary)]">
              No projects in this organization.
            </p>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => {
                const isChecked = selected.has(project.id);
                return (
                  <label
                    key={project.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--landing-surface-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(project.id)}
                      className="h-4 w-4 rounded border-[var(--landing-border)] accent-[#F97316]"
                    />
                    <FolderOpen className="h-4 w-4 shrink-0 text-[var(--landing-text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-[var(--landing-text)]">
                        {project.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                        {project.slug}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#F97316] text-white hover:bg-[#FB923C]"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
