"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/shared/page-header";

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/projects/${projectSlug}?org=${orgSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          description: description || undefined,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader badge="Settings" title="Project Settings" />

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
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#F97316] text-white hover:bg-[#FB923C]"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="dash-card relative mt-6 border-red-500/20 p-6">
        <h2 className="mb-2 font-mono text-sm font-bold text-red-500">
          Danger Zone
        </h2>
        <p className="mb-4 text-sm text-[var(--landing-text-tertiary)]">
          Deleting a project will permanently remove all memories.
        </p>
        <Button variant="destructive">Delete Project</Button>
      </div>
    </div>
  );
}
