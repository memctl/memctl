"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Terminal } from "lucide-react";
import { CopyMcpConfig } from "./copy-mcp-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export interface ProjectSettingsProps {
  orgSlug: string;
  projectSlug: string;
  project: {
    name: string;
    description: string | null;
    slug: string;
    createdAt: string;
  };
  mcpConfig: string;
}

export function ProjectSettings({
  orgSlug,
  projectSlug,
  project,
  mcpConfig,
}: ProjectSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectSlug}?org=${orgSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          description: description || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save project settings");
      } else {
        toast.success("Project settings saved");
        router.refresh();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectSlug}?org=${orgSlug}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Project deleted");
        router.push(`/org/${orgSlug}`);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete project");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        {/* General form */}
        <div className="lg:col-span-3">
          <div className="dash-card glass-border relative p-6">
            <h2 className="mb-4 font-mono text-sm font-bold text-[var(--landing-text)]">
              General
            </h2>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-[var(--landing-text-secondary)]">
                  Project Name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={projectSlug}
                  className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--landing-text-secondary)]">
                  Description
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--landing-text-secondary)]">
                  Slug
                </Label>
                <Input
                  value={project.slug}
                  disabled
                  className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)]"
                />
                <p className="mt-1 text-[10px] text-[var(--landing-text-tertiary)]">
                  Slugs cannot be changed after creation
                </p>
              </div>
              <div>
                <Label className="text-xs text-[var(--landing-text-secondary)]">
                  Created
                </Label>
                <Input
                  value={new Date(project.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  disabled
                  className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)]"
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#F97316] text-white hover:bg-[#FB923C]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* MCP config display */}
        <div className="lg:col-span-2">
          <div className="dash-card glass-border-always relative overflow-hidden p-5">
            <h2 className="mb-3 font-mono text-sm font-bold text-[var(--landing-text)]">
              MCP Configuration
            </h2>
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#F97316]/20 bg-[#F97316]/5 px-3 py-2">
              <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F97316]" />
              <p className="font-mono text-[11px] leading-relaxed text-[var(--landing-text-secondary)]">
                Run <code className="rounded bg-[var(--landing-surface-2)] px-1 py-0.5 text-[#F97316]">npx memctl auth</code> to authenticate. No token needed in the config.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-[var(--landing-code-bg)] p-4">
              <CopyMcpConfig config={mcpConfig} />
              <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[var(--landing-text-secondary)]">
                {mcpConfig}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="dash-card relative border-red-500/20 p-6">
        <h2 className="mb-2 font-mono text-sm font-bold text-red-500">
          Danger Zone
        </h2>
        <p className="mb-4 text-sm text-[var(--landing-text-tertiary)]">
          Deleting a project will permanently remove all memories, activity logs, and session data.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete Project</Button>
          </DialogTrigger>
          <DialogContent className="border-[var(--landing-border)] bg-[var(--landing-bg)]">
            <DialogHeader>
              <DialogTitle className="text-[var(--landing-text)]">Delete project</DialogTitle>
              <DialogDescription className="text-[var(--landing-text-tertiary)]">
                This action cannot be undone. All memories, activity logs, and session data will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label className="text-xs text-[var(--landing-text-secondary)]">
                Type <code className="rounded bg-[var(--landing-surface-2)] px-1 py-0.5 font-mono text-red-400">{project.slug}</code> to confirm
              </Label>
              <Input
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                placeholder={project.slug}
                className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-[var(--landing-text)]"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="border-[var(--landing-border)] text-[var(--landing-text-secondary)]">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmSlug !== project.slug || deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete project"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
